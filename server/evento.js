'use strict';

const evento = {
  slug: 'clinica-monitor-futbol-2026',
  title: 'Clínica Certificado Monitor de Fútbol',
  edition: '2da versión',
  description:
    'Clínica presencial de un día para formarte como monitor de fútbol, con Williams Olave Fritz, jefe de scouting de Palestino. Incluye coffee break, polera de regalo, agenda y lápiz, grabación con dron y certificado del Colegio de Entrenadores de Fútbol de Chile.',
  startsAt: '2026-11-13T10:00:00-03:00',
  endsAt: '2026-11-13T14:00:00-03:00',
  timezone: 'America/Santiago',
  venue: {
    name: 'Sport Park Malloco',
    commune: 'Peñaflor',
    city: 'Malloco',
    country: 'Chile',
  },
  speaker: {
    name: 'Williams Olave Fritz',
    role: 'Jefe de scouting de Palestino',
  },
  organizers: ['Williams Sport', 'Colegio de Entrenadores de Fútbol de Chile'],
  includes: [
    { id: 'coffee-break', label: 'Coffee break' },
    { id: 'polera', label: 'Polera de regalo', note: 'Debes indicar talla' },
    { id: 'agenda-lapiz', label: 'Agenda y lápiz' },
    { id: 'dron', label: 'Grabación con dron' },
    {
      id: 'certificado',
      label: 'Certificado',
      issuer: 'Colegio de Entrenadores de Fútbol de Chile',
    },
  ],
  price: {
    amount: 100000,
    currency: 'CLP',
    label: '$100 mil',
    note: 'Costo total',
  },
  contact: {
    whatsapp: '+56984267737',
    whatsappDisplay: '+56 9 8426 7737',
    instagram: '@williamssport.oficial',
  },
  paymentMethods: [
    {
      id: 'webpay',
      label: 'Webpay',
      enabled: true,
      description: 'Tarjeta de crédito, débito o prepago a través de Transbank',
    },
  ],
  // Por confirmar con el cliente. Cambiar solo aquí.
  sizes: ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
  status: 'open',
  images: [],
};

module.exports = evento;
