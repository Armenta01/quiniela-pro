const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  usuario: String,
  partido: { type: mongoose.Schema.Types.ObjectId, ref: 'Partido' },
  prediccion: String
});

module.exports = mongoose.model('Pronostico', schema);