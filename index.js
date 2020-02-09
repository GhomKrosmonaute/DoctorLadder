
const config = require('./config.json')

const pg = require('pg')
const Score = require('discord-scores')
const { Client, RichEmbed } = require('discord.js')
const moment = require('moment')

moment.locale('fr-FR')
pg.defaults.parseInt8 = false

const db = new pg.Pool(config.database)
const client = new Client()
const scores = new Score( client, [
    {'507420549765529610':2},
    {'👎':-1},
    {'👍':1}
])

db.connect()
client.login(config.token)

client.once( 'ready', yay => {
    client.labs = client.guilds.first()
    client.labs.gif = client.labs.iconURL.replace(/(jpe?g|png)$/,'gif')
    console.log('Bot is ready')
})

client.on( 'message', message => {

    if(message.system || message.author.bot) return

    if(/^(?:l!)?m?\s?(?:top|ladder)$/i.test(message.content)){
        showLadder(message, 'Top 10 Donators', `
            SELECT author_id AS "id", SUM("value") AS "points"
            FROM "helping_points"
            GROUP BY "id"
            ORDER BY "points" DESC LIMIT 10
        `)
        showLadder(message, 'Top 10 Helpers', `
            SELECT user_id AS "id", SUM("value") AS "points"
            FROM "helping_points"
            GROUP BY "id"
            ORDER BY "points" DESC LIMIT 10
        `)
    }

    if(/^l!logs?$/i.test(message.content)){
        showLogs(message)
    }

})

scores.on('add', event => updateScore(event, event.value))
scores.on('remove', event => updateScore(event, event.value * -1))

async function showLogs(message){
    db.query(`
        SELECT * FROM "helping_points"
        ORDER BY "created_at" DESC LIMIT 20
    `)
        .then( async res => {
            
            const embed = new RichEmbed()
                .setAuthor('20 Derniers Logs', client.labs.gif)

            const logs = []
            
            for( row of res.rows){
                
                const author = client.users.get(row.author_id) || await client.fetchUser(row.author_id)
                const target = client.users.get(row.user_id) || await client.fetchUser(row.user_id)

                if(!author || !target) continue

                let action = 'donne'
                if(row.value < 0){
                    action = 'retire'
                    row.value *= -1
                }

                logs.push(`${moment(row.created_at).fromNow()}, **${author.username}** ${action} \`${row.value}\` à **${target.username}**`)

            }

            embed.setDescription(logs.join('\n'))

            message.channel.send(embed)

        })
}

function showLadder(message, title, query){
    db.query(query)
        .then(async res => {

            const embed = new RichEmbed()
                .setAuthor(title, client.labs.gif)

            if(res.rows.length > 0){

                const ranks = ['🥇','🥈','🥉',4,5,6,7,8,9,10].slice(0,res.rows.length)

                if(!/^m/i.test(message.content)){

                    const users = await Promise.all(res.rows.map(row => client.users.has(row.id) ? client.users.get(row.id) : client.fetchUser(row.id)))
                    const names = users.map(user => user.username.slice(0,15))
                    const points = res.rows.map(row => row.points)

                    const rdm = Math.floor(Math.random(Math.min(res.rows.length,3)))
                    client.user.setActivity(`le top 3 |\n${ranks[rdm]} ${points[rdm]}pts ${names[rdm]}`, {type:"WATCHING"})

                    embed.addField('#', ranks.join('\n'), true)
                    embed.addField('Pts.', points.join('\n'), true)
                    embed.addField('Names', names.join('\n'), true)

                }else{

                    embed.setDescription(res.rows.map(( row, i )=> {
                        const name = client.labs.members.has(row.id) ? client.labs.members.get(row.id).displayName.slice(0,15) : row.id
                        return `${ranks[i]} : ${row.points} pts : ${name}`
                    }).join('\n'))

                }

            }else{
                embed.setDescription('❌ Aucun résultat...')
            }
            message.channel.send(embed)
        })
        .catch(err => {
            message.channel.send(err.message)
        })
}

function updateScore(event, value){
    db.query(`
        INSERT INTO "user" ( id )
        VALUES ( ${event.message.author.id} )
        ON CONFLICT DO NOTHING
    `)
        .then(done => {
            return db.query({
                text: `
                    INSERT INTO "helping_points" 
                    ( user_id, author_id, value )
                    VALUES ( 
                        ${event.message.author.id},
                        ${event.user.id},
                        $1
                    )
                `,
                values: [ value ]
            })
        })
        .then(done => {
            return event.message.react('👀')
        })
        .then(reac => {
            setTimeout(()=>{
                reac.remove().catch(err=>{})
            }, 2000)
        })
        .catch(console.error)
        
}