const userList = document.getElementById('user-list');

export function addUser(username) {
    const userItem = document.createElement('div');
    userItem.classList.add('user-item');
    userItem.textContent = username;
    userList.appendChild(userItem);
}

export function removeUser(username) {
    const userItems = userList.getElementsByClassName('user-item');
    for (let i = 0; i < userItems.length; i++) {
        if (userItems[i].textContent === username) {
            userList.removeChild(userItems[i]);
            break;
        }
    }
}