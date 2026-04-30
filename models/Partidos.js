const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  local: String,
  visitante: String,
  fecha: Date,
  resultado: String
});

module.exports = mongoose.model('Partido', schema);