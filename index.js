
const config = require('./config.json')

const pg = require('pg')
const Score = require('discord-scores')
const { Client, RichEmbed } = require('discord.js')

pg.defaults.parseInt8

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

    const { labs } = client

    if(/^m?(top|ladder)$/i.test(message.content)){
        db.query(`
            SELECT u.id, SUM(hp.value) AS "points"
            FROM "user" u
            LEFT JOIN "helping_points" hp
            ON hp.user_id = u.id
            GROUP BY u.id
            ORDER BY "points" DESC LIMIT 10
        `)
            .then(res => {

                let embed = new RichEmbed()
                    .setAuthor('Top 10 Helpers', labs.gif)

                if(res.rows.length > 0){

                    const ranks = ['🥇','🥈','🥉',4,5,6,7,8,9,10].slice(0,res.rows.length)

                    if(!/^m/i.test(message.content)){

                        const names = res.rows.map(row => labs.members.has(row.id) ? labs.members.get(row.id).displayName.slice(0,15) : row.id)
                        const points = res.rows.map(row => row.points)

                        const rdm = Math.floor(Math.random(Math.min(res.rows.length,3)))
                        client.user.setActivity(`le top 3 |\n${ranks[rdm]} ${points[rdm]}pts ${names[rdm]}`, {type:"WATCHING"})

                        embed.addField('#', ranks.join('\n'), true)
                        embed.addField('Pts.', points.join('\n'), true)
                        embed.addField('Names', names.join('\n'), true)

                    }else{

                        embed.setDescription(res.rows.map(( row, i )=> {
                            const name = labs.members.has(row.id) ? labs.members.get(row.id).displayName.slice(0,15) : row.id
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

})

scores.on('add', event => updateScore(event, event.value))
scores.on('remove', event => updateScore(event, event.value * -1))

function updateScore(event, value){
    db.query(`
        INSERT INTO "user" ( id )
        VALUES ( ${event.message.author.id} )
        ON CONFLICT DO NOTHING
    `)
        .then(done => {
            db.query({
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
                .then(res => {
                    event.message.react('👀')
                        .then(reac => {
                            setTimeout(()=>{
                                reac.remove().catch(err=>{})
                            }, 2000)
                        }).catch(err=>{})
                }).catch(console.error)
        }).catch(console.error)
        
}