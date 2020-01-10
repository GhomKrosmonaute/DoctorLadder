
const config = require('./config.json')

const { Pool } = require('pg')
const { Client } = require('discord.js')
const Score = require('discord-scores')

const db = new Pool(config.database)
const client = new Client()
const scores = new Score( client, [
    {'507420549765529610':2},
    {'👎':-1},
    {'👍':1}
])

db.connect()
client.login(config.token)

client.once( 'ready', yay => {
    console.log('Bot is ready')
    client.ready = true
})

client.on( 'message', message => {

    if(message.system || message.author.bot) return

    if(/^(?:top|ladder|classement|helping|scores?|points?)$/i.test(message.content)){
        db.query(`SELECT * FROM "user" ORDER BY helping_points DESC LIMIT 10`)
            .then(res => {
                message.channel.send(JSON.stringify(res.rows, null, 2))
            })
            .catch(console.error)
    }

})

scores.on('add', event => updateScore(event, event.value > 0 ? '+' : '-'))
scores.on('remove', event => updateScore(event, event.value > 0 ? '-' : '+'))

function updateScore(event, sign){
    const value = String(event.value).replace('-','')
    db.query({
        text: `
            INSERT INTO "user" ( member_id, helping_points )
            VALUES ( $2, ${sign=='+'?'':sign}$1 )
            ON CONFLICT ( member_id )
            DO UPDATE SET helping_points = Excluded.helping_points ${sign} $1
        `,
        values: [ value, event.message.author.id ]
    })
        .then(res => event.message.react('👀').catch(err=>{}))
        .catch(console.error)
}