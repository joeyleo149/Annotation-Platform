const mysql = require('mysql2/promise');

async function reset() {
  try {
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'YOUR_MYSQL_PASSWORD', // Replace with your actual MySQL password
    });

    await connection.query('DROP DATABASE IF EXISTS KitScenesAnnotationDb;');
    await connection.query('CREATE DATABASE KitScenesAnnotationDb;');
    console.log('Database successfully reset!');
    await connection.end();
  } catch (err) {
    console.error('Error resetting database:', err);
  }
}

reset();