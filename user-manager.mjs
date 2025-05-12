const userList = document.getElementById('user-list');

export function addUser(uuid, username) {
    const userItem = document.createElement('div');
    userItem.classList.add('user-item');
    userItem.textContent = username;
    userItem.dataset.uuid = uuid;
    userList.appendChild(userItem);
    updateLayout();
}

export function removeUser(uuid) {
    const userItems = userList.getElementsByClassName('user-item');
    for (let i = 0; i < userItems.length; i++) {
        if (userItems[i].dataset.uuid === uuid) {
            userList.removeChild(userItems[i]);
            break;
        }
    }
    updateLayout();
}

export function clearUserList() {
    while (userList.firstChild) {
        userList.removeChild(userList.firstChild);
    }
}

export function updateLayout() {
    const numberOfUsers = voiceChatContainer.querySelectorAll('.user-item').length;
    voiceChatContainer.className = 'user-list';
    if (numberOfUsers === 1) {
        voiceChatContainer.classList.add('one-user');
    } else if (numberOfUsers === 2) {
        voiceChatContainer.classList.add('two-users');
    } else if (numberOfUsers > 2) {
        voiceChatContainer.classList.add('multiple-users');
        const bestGrid = calculateGrid(numberOfUsers);
        voiceChatContainer.style.gridTemplateColumns = `repeat(${bestGrid.cols}, 1fr)`;
    }
}

function calculateGrid(n) {
    let cols = Math.ceil(Math.sqrt(n));
    while (cols > 0 && n % cols !== 0) {
        cols--;
    }
    let rows = Math.ceil(n / cols);
    return { cols, rows };
}