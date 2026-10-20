'use strict';

const path = require('node:path');
const fs = require('node:fs');
const Database = require('better-sqlite3');

const DEFAULT_DB_PATH = path.join(__dirname, 'data', 'william.db');

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS ordenes (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  fullName         TEXT    NOT NULL,
  email            TEXT    NOT NULL,
  phone            TEXT    NOT NULL,
  size             TEXT    NOT NULL,
  buyOrder         TEXT    NOT NULL UNIQUE,
  status           TEXT    NOT NULL DEFAULT 'pending',
  amount           INTEGER NOT NULL,
  webpayToken      TEXT,
  receiptToken     TEXT    UNIQUE,
  authorizationCode TEXT,
  cardLast4        TEXT,
  paymentTypeCode  TEXT,
  installments     INTEGER,
  transactionDate  TEXT,
  rawResponse      TEXT,
  createdAt        TEXT    NOT NULL,
  updatedAt        TEXT    NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ordenes_status ON ordenes (status);
CREATE INDEX IF NOT EXISTS idx_ordenes_receipt ON ordenes (receiptToken);
`;

function createDb(dbPath = process.env.DB_PATH || DEFAULT_DB_PATH) {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(CREATE_SQL);
  return db;
}

module.exports = { createDb, DEFAULT_DB_PATH };
