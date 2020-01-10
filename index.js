
const config = require('./config.json')

const { Pool } = require('pg')
const { Client } = require('discord.js')
const Score = require('discord-scores')

const db = new Pool(config.database)
const client = new Client()
const scores = new Score(client,[
    {'507420549765529610':2},
    {'👎':-1},
    {'👍':1}
])

db.connect()
client.login(config.token)

client.once( 'ready', yay => {
    console.log('Bot is ready', yay)
})

scores.on('add', event => changeScore(event, event.value > 0 ? '+' : '-'))
scores.on('remove', event => changeScore(event, event.value > 0 ? '-' : '+'))

function changeScore(event, sign){
    const value = String(event.value).replace('-','')
    db.query({
        text: 'UPDATE `score` SET `point` = `point` ' + sign + ' $1 WHERE `user_id` = $2',
        values: [ value, event.user.id ]
    })
        .then(res => event.message.react('👀').catch(err=>{}))
        .catch(console.error)
}