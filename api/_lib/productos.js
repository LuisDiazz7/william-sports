import crypto from 'node:crypto';

const PRODUCTOS = {
  'clinica-monitor-futbol-2026': {
    id: 'clinica-monitor-futbol-2026',
    nombre: 'Clínica Certificado Monitor de Fútbol',
    edicion: '2da versión',
    glosa: 'Clínica Certificado Monitor de Fútbol - 13 nov 2026',
    monto: 100000,
    moneda: 'CLP',
    buyOrderPrefix: 'CLI26',
  },
};

export function getProducto(id) {
  if (typeof id !== 'string') return null;
  return PRODUCTOS[id] || null;
}

export function findProductoByBuyOrder(buyOrder) {
  if (typeof buyOrder !== 'string' || !buyOrder) return null;
  return (
    Object.values(PRODUCTOS).find((producto) =>
      buyOrder.startsWith(`${producto.buyOrderPrefix}-`)
    ) || null
  );
}

export function generarBuyOrder(producto) {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(5).toString('hex').toUpperCase();
  return `${producto.buyOrderPrefix}-${stamp}${random}`.slice(0, 26);
}
