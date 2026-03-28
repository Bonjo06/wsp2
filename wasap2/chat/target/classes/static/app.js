let currentUser = null;
let selectedContact = null;
let users = [];
let conversations = {};
let webSocket = null;
let pollInterval = null;
let usersPollInterval = null;
let lastMessageCheckTime = {};
let shownMessageIds = new Set();
let shownUserIds = new Set();

const API_URL = 'http://localhost:8080/api/messages';
const WS_URL = 'ws://localhost:8080/ws/chat';

const usersList = document.getElementById('usersList');
const createUserBtn = document.getElementById('createUserBtn');
const createUserModal = document.getElementById('createUserModal');
const newUserName = document.getElementById('newUserName');
const confirmCreateBtn = document.getElementById('confirmCreateBtn');
const cancelCreateBtn = document.getElementById('cancelCreateBtn');
const selectSenderModal = document.getElementById('selectSenderModal');
const senderslist = document.getElementById('senderslist');
const closeModal = document.getElementById('closeModal');
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const chatTitle = document.getElementById('chatTitle');

// crear usuario
createUserBtn.addEventListener('click', () => {
    createUserModal.classList.remove('hidden');
    newUserName.focus();
});

confirmCreateBtn.addEventListener('click', createUser);
cancelCreateBtn.addEventListener('click', () => {
    createUserModal.classList.add('hidden');
    newUserName.value = '';
});

newUserName.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') createUser();
});
 // enviar mensaje
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabName = tab.getAttribute('data-tab');
        switchTab(tabName);
    });
});

closeModal.addEventListener('click', () => {
    selectSenderModal.classList.add('hidden');
});

// funciones
// crear usuario
async function createUser() {
    const name = newUserName.value.trim();
    if (!name) {
        alert('Por favor ingresa un nombre');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/users?name=${encodeURIComponent(name)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Error al crear usuario');

        const user = await response.json();
        users.push(user);
        shownUserIds.add(user.id); 
        
        createUserModal.classList.add('hidden');
        newUserName.value = '';
        
        if (!currentUser) {
            showSenderSelection();
        } else {
            renderUsersList();
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al crear usuario');
    }
}

// seleccion de remitente
function showSenderSelection() {
    senderslist.innerHTML = '';
    users.forEach(user => {
        const item = document.createElement('div');
        item.className = 'user-modal-item';
        item.innerHTML = `
            <strong>${user.name}</strong>
            <small style="display: block; color: #999;">ID: ${user.id}</small>
        `;
        item.addEventListener('click', () => {
            selectUser(user);
            selectSenderModal.classList.add('hidden');
        });
        senderslist.appendChild(item);
    });

    if (users.length > 0) {
        selectSenderModal.classList.remove('hidden');
    }
}

// seleccionar usuario
function selectUser(user) {
    if (webSocket) {
        webSocket.close();
        webSocket = null;
    }

    currentUser = user;
    selectedContact = null;
    messagesContainer.innerHTML = '<p class="info-text">Para empezar a chatear, selecciona un contacto</p>';
    messageInput.disabled = true;
    sendBtn.disabled = true;
    
    renderUsersList();
    connectWebSocket();
}

// lista de usuarios
function renderUsersList() {
    usersList.innerHTML = '';
    
    users.forEach(user => {
        if (user.id === currentUser.id) return; 
        
        const userItem = document.createElement('div');
        userItem.className = `user-item ${selectedContact?.id === user.id ? 'active' : ''}`;
        userItem.innerHTML = `
            <span class="user-name">${user.name}</span>
            <span class="user-id">ID: ${user.id}</span>
        `;
        
        userItem.addEventListener('click', () => {
            selectedContact = user;
            renderUsersList();
            if (pollInterval) {
                clearInterval(pollInterval);
            }
            loadConversation(currentUser.id, user.id);
        });
        
        usersList.appendChild(userItem);
    });
}

// carga conversacion
async function loadConversation(userId1, userId2) {
    try {
        const response = await fetch(`${API_URL}/conversation?user1Id=${userId1}&user2Id=${userId2}`);
        
        if (!response.ok) throw new Error('Error al cargar conversación');

        const messages = await response.json();
        const conversationKey = `${Math.min(userId1, userId2)}-${Math.max(userId1, userId2)}`;
        conversations[conversationKey] = messages;
        
        renderMessages(messages, userId1);
        chatTitle.textContent = `Estas chateando con: ${selectedContact.name}`;
        messageInput.disabled = false;
        sendBtn.disabled = false;
        messageInput.focus();
        
        startPolling(userId1, userId2, messages);
    } catch (error) {
        console.error('Error:', error);
        messagesContainer.innerHTML = '<p class="info-text">Error al cargar la conversación</p>';
    }
}

// render mensajes
function renderMessages(messages, currentUserId) {
    messagesContainer.innerHTML = '';
    
    if (messages.length === 0) {
        messagesContainer.innerHTML = '<p class="info-text">No hay mensajes en este chat. </p>';
        return;
    }

    messages.forEach(message => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.sender.id === currentUserId ? 'sent' : 'received'}`;
        
        const time = new Date(message.timestamp).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
        });
        
        messageDiv.innerHTML = `
            <div>
                <div class="message-bubble">${escapeHtml(message.content)}</div>
                <div class="message-time">${time}</div>
            </div>
        `;
        
        messagesContainer.appendChild(messageDiv);
    });

    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// enviar mensaje
async function sendMessage() {
    const content = messageInput.value.trim();
    
    if (!content) return;
    if (!currentUser || !selectedContact) {
        alert('Por favor selecciona un usuario');
        return;
    }

    try {
        const response = await fetch(
            `${API_URL}/send?senderId=${currentUser.id}&receiverId=${selectedContact.id}&content=${encodeURIComponent(content)}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            }
        );

        if (!response.ok) throw new Error('Error al enviar mensaje');

        const message = await response.json();
        messageInput.value = '';
        
        shownMessageIds.add(message.id);
        
        addMessageToUI(message, true);
        
        if (webSocket && webSocket.readyState === WebSocket.OPEN) {
            webSocket.send(JSON.stringify(message));
        } else {
            console.warn('WebSocket no está conectado');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Error al enviar mensaje');
    }
}


function switchTab(tabName) {
    tabs.forEach(tab => {
        tab.classList.remove('active');
        if (tab.getAttribute('data-tab') === tabName) {
            tab.classList.add('active');
        }
    });

    // Actualizar contenido de pestañas
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    document.getElementById(tabName).classList.add('active');
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function connectWebSocket() {
    if (!currentUser) return;

    if (webSocket && webSocket.readyState === WebSocket.OPEN) {
        webSocket.close();
    }

    webSocket = new WebSocket(`${WS_URL}?userId=${currentUser.id}`);

    webSocket.onopen = () => {
    };

    webSocket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            
            // guardar el mensaje en el cache de conversaciones
            const conversationKey = `${Math.min(message.senderId, currentUser.id)}-${Math.max(message.senderId, currentUser.id)}`;
            if (!conversations[conversationKey]) {
                conversations[conversationKey] = [];
            }
            
            // verificar existencia del mensaje 
            const messageExists = conversations[conversationKey].some(m => m.id === message.id);
            if (!messageExists) {
                conversations[conversationKey].push(message);
            }
            
            // mostrar mensaje en tiempo real
            if (selectedContact && message.senderId === selectedContact.id && message.receiverId === currentUser.id) {
                addMessageToUI(message, false);
            }
        } catch (error) {
            console.error('Error procesando mensaje ', error);
        }
    };

    webSocket.onerror = (error) => {
    };

    webSocket.onclose = () => {
        if (currentUser) {
            setTimeout(connectWebSocket, 2000);
        }
    };
}

function addMessageToUI(message, isSent) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isSent ? 'sent' : 'received'}`;
    
    const time = new Date(message.timestamp).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <div>
            <div class="message-bubble">${escapeHtml(message.content)}</div>
            <div class="message-time">${time}</div>
        </div>
    `;
    
    messagesContainer.appendChild(messageDiv);
    
    
    setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }, 10);
}

function startPolling(userId1, userId2, initialMessages = []) {
    
    if (pollInterval) {
        clearInterval(pollInterval);
    }

    
    shownMessageIds.clear();
    initialMessages.forEach(msg => {
        shownMessageIds.add(msg.id);
    });
    
    pollInterval = setInterval(async () => {
        if (!currentUser || !selectedContact) {
            clearInterval(pollInterval);
            return;
        }

        try {
            const response = await fetch(`${API_URL}/conversation?user1Id=${userId1}&user2Id=${userId2}`);
            if (!response.ok) return;

            const allMessages = await response.json();
            
            allMessages.forEach(msg => {
                if (!shownMessageIds.has(msg.id)) {
                    shownMessageIds.add(msg.id);
                    const isSent = msg.sender.id === currentUser.id;
                    addMessageToUI(msg, isSent);
                }
            });
        } catch (error) {
            console.error('Error en polling:', error);
        }
    }, 1500); 
}

// Cargar usuarios al iniciar
async function loadUsers() {
    try {
        const response = await fetch(`${API_URL}/users`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' }
        });

        if (response.ok) {
            users = await response.json();
            
            users.forEach(user => {
                shownUserIds.add(user.id);
            });
            
            if (users.length === 0) {
                createUserModal.classList.remove('hidden');
            } else if (!currentUser) {
                showSenderSelection();
            } else {
                renderUsersList();
            }
            
            startUsersPolling();
        }
    } catch (error) {
        console.error('Error al cargar usuarios:', error);
    }
}

function startUsersPolling() {
    if (usersPollInterval) {
        clearInterval(usersPollInterval);
    }

    usersPollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_URL}/users`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) return;

            const allUsers = await response.json();
            
            allUsers.forEach(user => {
                if (!shownUserIds.has(user.id)) {
                    shownUserIds.add(user.id);
                    users.push(user);
                    
                    // Actualizar barra lateral
                    if (currentUser) {
                        renderUsersList();
                    }
                }
            });
        } catch (error) {
            console.error('Error ', error);
        }
    }, 1500);
}


loadUsers();
