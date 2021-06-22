// ==UserScript==
// @name         Attendance List
// @namespace    https://github.com/kauetech/meet-userscripts
// @version      1.0
// @description  Algumas funcionalidades extras para fazer chamadas no Google Meet.
// @author       @KaueTech
// @match        https://meet.google.com/*
// @icon         https://www.google.com/s2/favicons?domain=meet.google.com
// @resource     stylecss https://github.com/KaueTech/meet-userscripts/raw/master/attendance/style.css
// @grant      GM_getResourceText
// ==/UserScript==

const participantIds = {}
const participants = {}
const messages = []
const logs = []

const commands = {
    'Digit1': async function () {
        updateUsers()
        showParticipantsAndLogsAndMessages()
    },

    'Digit2': async function () {
        let keyword = prompt('Digite uma palavra-chave para fazer a chamada:', 'Presente')

        if (!keyword) {
            alert('Você não digitou nenhuma palavra-chave.')
            return
        }

        let timeout = parseInt(prompt(`Digite um intervalo de tempo em segundos para os participantes digitarem "${keyword}" no chat:`, '60'))

        if (isNaN(timeout)) {
            alert('Você digitou uma quantidade de segundos inválida.')
            return
        }

        let startText = `A chamada foi iniciada, Você tem ${timeout} segundos para digitar "${keyword}" no chat.`
        sendMessage(startText)

        await new Promise(r => setTimeout(r, timeout * 1000))

        updateUsers()
        updateMessages()

        Object.values(participants).forEach(participant => {
            participant.present = false
        })

        let initialIndex = 0

        messages.forEach((message, index) => {
            if (message.text === startText) {
                initialIndex = index
            }
        })

        messages.slice(initialIndex).forEach(message => {
            if (message.text.toLowerCase().includes(keyword.toLowerCase())) {
                message.sender.present = true
            }
        })

        sendMessage(`A chamada foi finalizada.`)

        await new Promise(r => setTimeout(r, 500))
        showParticipantsAndLogsAndMessages(true)

    },

    'Digit3': async function () {

        let keyword = prompt('Digite uma palavra-chave para fazer a chamada:', 'Presente')

        if (!keyword) {
            alert('Você não digitou nenhuma palavra-chave.')
            return
        }

        updateUsers()
        updateMessages()

        Object.values(participants).forEach(participant => {
            participant.present = false
        })

        messages.forEach(message => {
            if (message.text.toLowerCase().includes(keyword.toLowerCase())) {
                message.sender.present = true
            }
        })

        await new Promise(r => setTimeout(r, 500))
        showParticipantsAndLogsAndMessages(true)
    },

    'Digit9': () => {
        console.log('Participants:', participants)
        console.log('Messages:', messages)
        console.log('Logs:', logs)
    },
}

async function Setup() {
    try {
        await openChatTab()
        await openParticipantsTab()

        await startParticipantsObserver()
        await startMessagesObserver()

        updateUsers()
        Start()
    }

    catch (error) {
        console.log(error)
    }
}

function Start() {
    document.addEventListener('keydown', event => {
        if (event.ctrlKey && event.shiftKey) {
            try {
                commands[event.code]?.call()
            } catch (error) {
                console.log(error)
            }
        }

        event.stopImmediatePropagation()
    })
}

function onMessage(message) {

}

function onParticipantJoin(participant) {
    let log = { participant, type: 'join', message: 'entrou', date: new Date() }
    logs.push(log)
}

function onParticipantQuit(participant) {
    let log = { participant, type: 'quit', message: 'saiu', date: new Date() }
    logs.push(log)
}

const keydownEnterEvent = new KeyboardEvent("keydown", {
    bubbles: true, cancelable: true, keyCode: 13
});

function sendMessage(text) {
    let textarea = document.querySelector(".tL9Q4c")

    textarea.value = text
    textarea.setAttribute('data-initial-value', text)
    textarea.dispatchEvent(keydownEnterEvent);
}

function showParticipantsAndLogsAndMessages(absentParticipants = false) {
    let win = window.open(
        'about:blank',
        `${new Date().getTime()}`
    )

    let doc = win.document

    doc.head.innerHTML += `
    <title>Lista de Presença</title>
    
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <link rel="preconnect" href="https://fonts.gstatic.com">
    <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700&display=swap" rel="stylesheet">
    `

    doc.head.innerHTML += `<style>${GM_getResourceText("stylecss")}</style>`

    let url = location.host + location.pathname
    let date = new Date()

    doc.body.innerHTML += `<h1>Lista de Presença</h1>
    <p><a href="https://${url}">${url}</a></p>
    <p>Gerado em ${date.toLocaleDateString()} ${date.toLocaleTimeString().slice(0, -3)}</p>`

    updateUsers()

    let ordenedParticipants = Object.values(participants).sort(function (a, b) {
        return a.name.localeCompare(b.name);
    });

    let usersHtml = ordenedParticipants.map(participant => {
        let status = null

        if (absentParticipants) {
            status = participant.present ? 'presente' : (participant.online ? 'ausente' : 'offline')
        } else {
            status = participant.online ? 'online' : 'offline'
        }

        return `
        <tr
        class='participant'
        name='${participant.name}' 
        image='${participant.image}' 
        status='${status}'
        time='${participant.onlineTime}'
        ${participant._self_ ? ' participant-self' : ''}>

            <td>
                <div>
                    <img class='participant-image' src="${participant.image}"alt="Foto de ${participant.name}">
                    <span class="participant-name">${participant.name}${participant._self_ ? ' (Você)' : ''}</span>
                </div>
            </td>        
                                
            <td>
                <div>
                    <div class="status-box"></div>
                    <span class='participant-status'>${status}</span>
                </div>
            </td>

            <td>
                <span class='participant-online-time'>${msTolocaleTime(participant.onlineTime)}</span>
            </td>
        </tr>`
    })

    let statusCountText = ''

    if (absentParticipants) {
        let presents = 0
        let absents = 0
        let offline = 0

        ordenedParticipants.forEach(participant => {
            participant.present ? presents += 1 : (participant.online ? absents += 1 : offline += 1)
        })

        statusCountText = `presentes: ${presents}, ausentes: ${absents}, offline: ${offline}`
    }

    else {
        let online = 0
        let offline = 0

        ordenedParticipants.forEach(participant => {
            participant.online ? online += 1 : offline += 1
        })

        statusCountText = `online: ${online}, offline: ${offline}`
    }

    doc.body.innerHTML += `
    <h2>Participantes (${ordenedParticipants.length})</h2>
    <p>${statusCountText}</p>

    <table class="content-table user-table">
        <thead>
            <tr>
                <th>Participante</th>
                <th>Status</th>
                <th>Tempo</th>
            </tr>
        </thead>
        <tbody>
        ${usersHtml.join('')}
        </tbody>
    </table>`

    let logsHtml = logs.map(log => {
        return `
        <tr
        class='log'
        type='${log.type}'
        user-id='${log.participant.image}'
        time='${log.date.getTime()}'
        'eventtype=${log.type}'
        ${log.participant._self_ ? 'participant-self' : ''}>

            <td>
                <div>
                    <img class='log-participant-image' src="${log.participant.image}"alt="Foto de ${log.participant.name}">
                    <span class="log-participant-name">${log.participant.name}${log.participant._self_ ? ' (Você)' : ''}</span>
                </div>
            </td>        
                                
            <td>
                <span class='log-message'>${log.message}</span>
            </td>

            <td>
                <span class='log-time'>${log.date.toLocaleTimeString().slice(0, -3)}</span>
            </td>
        </tr>`
    })

    doc.body.innerHTML += `
    <h2>Histórico</h2>
    
    <table class="content-table logs-table">
        <thead>
            <tr>
                <th>Participante</th>
                <th>Mensagem</th>
                <th>Horário</th>
            </tr>
        </thead>
        <tbody>
        ${logsHtml.join('')}
        </tbody>
    </table>`

    doc.body.innerHTML += '<div style="width: 100%; height: 32px; color: rgba(0, 0, 0, 0)">this div is to fix a window bug</div>'
}

async function startParticipantsObserver() {
    let element = await asyncAwaitQuerySelector('.Ze1Fpc')

    new MutationObserver(() => updateUsers()).observe(element, {
        childList: true,
        subtree: true
    })
}

async function startMessagesObserver() {
    let element = await asyncAwaitQuerySelector('.hPqowe')

    new MutationObserver(() => updateMessages()).observe(element, {
        childList: true,
        subtree: true,
    })
}

function updateMessages() {
    let newMessages = []

    document.querySelectorAll('div[class="oIy2qc"]:not([attendance-cached-message])').forEach(element => {
        element.setAttribute('attendance-cached-message', '')

        let parent = element.parentElement.parentElement
        let text = element.textContent
        let senderId = parent.getAttribute('data-sender-id')
        let timestamp = parseInt(parent.getAttribute('data-timestamp'))

        let sender = participantIds[senderId]
        let date = new Date(timestamp)

        let message = {
            text, sender, date
        }

        messages.push(message)
        newMessages.push(message)
        setTimeout(() => onMessage(message), 0)
    })

    return newMessages

}

function updateUsers() {
    let onlineParticipants = []

    document.querySelectorAll('.Ze1Fpc .KV1GEc').forEach(elem => {

        let image = elem.querySelector('.G394Xd').getAttribute('src')

        let participant = participants[image] || (participants[image] = {
            name: elem.querySelector('.ZjFb7c').textContent,
            image,
            online: false,
            present: false,
            onlineTime: 0,
            lastOnline: false,
            firstJoin: new Date(),
            _self_: false,
        })

        participantIds[elem.getAttribute('data-participant-id')] = participant

        if (elem.querySelector('.QMC9Zd')) {
            participantIds['_self_'] = participant
            participant._self_ = true
        }
        participant.online = true

        if (!onlineParticipants.includes(participant)) {
            onlineParticipants.push(participant)
        }
    })

    Object.values(participants).forEach(participant => {
        participant.online = onlineParticipants.includes(participant)

        let date = new Date()

        if (participant.lastOnline || participant.online) {
            if (participant.lastUpdate) {
                participant.onlineTime += date.getTime() - participant.lastUpdate.getTime()
            }

            participant.lastUpdate = date
        }

        else if (!participant.online) {
            participant.lastUpdate = null
        }

        if (!participant.lastOnline && participant.online) {
            setTimeout(() => onParticipantJoin(participant), 0)
        }

        else if (participant.lastOnline && !participant.online) {
            setTimeout(() => onParticipantQuit(participant), 0)
        }

        participant.lastOnline = participant.online
    })
}

async function openChatTab() {
    let chatBtn = await asyncAwaitQuerySelector('button[data-tooltip-enabled="true"][aria-label="Chat com todos"]')
    chatBtn.click()

    await asyncAwaitQuerySelector('.WUFI9b[data-tab-id="2"] .v8W0vf')
}

async function openParticipantsTab() {
    let participantsBtn = await asyncAwaitQuerySelector('button[data-tooltip-enabled="true"][aria-label="Mostrar todos"]')
    participantsBtn.click()

    await asyncAwaitQuerySelector('.WUFI9b[data-tab-id="1"] .KV1GEc')
}

function msTolocaleTime(ms) {

    let seconds = ms / 1000

    let hoursRest = seconds % 3600
    let minutesRest = hoursRest % 60

    let localeHours = (seconds - hoursRest) / 3600
    let localeMinutes = (hoursRest - minutesRest) / 60
    let localeSeconds = Math.floor(minutesRest)

    return `${localeHours > 0 ? `${localeHours}h ` : ''}${localeMinutes > 0 ? `${localeMinutes}min ` : ''}${localeSeconds > 0 ? `${localeSeconds}s ` : '0s'}`
}


async function asyncAwaitQuerySelector(selector) {
    let element = null

    while (!(element = document.querySelector(selector))) {
        await new Promise(r => setTimeout(r, 500));
    }

    return element
}

// Executa as funções start e setup
Setup()