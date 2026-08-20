import React from 'react'
import ReactDOM from 'react-dom/client'
import CastingAcademy from './CastingAcademy'
import FinanceTool from './finance/FinanceTool'

// Le site vitrine est à la racine ; l'outil de gestion financière est servi
// sur /finance (vercel.json réécrit toutes les routes vers index.html).
const estFinance = typeof window !== 'undefined' && window.location.pathname.replace(/\/+$/, '').toLowerCase() === '/finance'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {estFinance ? <FinanceTool /> : <CastingAcademy />}
  </React.StrictMode>
)
