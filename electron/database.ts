import { app } from 'electron'
import path from 'node:path'
const knex = require('knex')

// 数据库配置函数
function configureDatabase() {
  // 获取用户数据目录的路径
  const userDataPath = app.getPath('userData')
  // 构建数据库文件的完整路径
  const dbPath = path.join(userDataPath, 'local.db')
  console.log('Database path:', dbPath)

  return knex({
    client: 'sqlite3',
    connection: {
      filename: dbPath,
    },
    useNullAsDefault: true,
  })
}

// 初始化数据库表
async function initTableConversations(knex: any) {
  const exists = await knex.schema.hasTable('conversations')
  if (!exists) {
    await knex.schema.createTable('conversations', function (table: any) {
      table.increments('id').primary()
      // table.string('chat_id')
      table.string('title')
      table.json('conversations')
      table.integer('created_at').defaultTo(Date.now())
    })
  }
}

export default (async function setupDatabase() {
  try {
    const knex = configureDatabase()
    await initTableConversations(knex)
    return knex
  } catch (error) {
    console.error('Database setup failed:', error)
    throw error // 或者处理错误
  }
})()
