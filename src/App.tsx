import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { useJson } from './lib/data'
import { formatDate } from './lib/format'
import Calculator from './pages/Calculator'
import Methodology from './pages/Methodology'
import Ranking from './pages/Ranking'
import type { MetaFile } from './types'

function navClass({ isActive }: { isActive: boolean }) {
  return isActive ? 'nav-link is-active' : 'nav-link'
}

function Layout() {
  const { data: meta } = useJson<MetaFile>('meta.json')

  return (
    <div className="app">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="M5 16a7 7 0 0 1 14 0"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
                <path
                  d="M12 15.8 16.3 9.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />
                <circle cx="12" cy="15.8" r="1.9" fill="currentColor" />
              </svg>
            </span>
            <div className="brand-text">
              <strong>Model Efficiency</strong>
              <span>OpenCode Go · uso pessoal</span>
            </div>
          </div>

          <nav className="nav" aria-label="Navegação principal">
            <NavLink to="/" end className={navClass}>
              Ranking
            </NavLink>
            <NavLink to="/calculadora" className={navClass}>
              Calculadora
            </NavLink>
            <NavLink to="/metodologia" className={navClass}>
              Metodologia
            </NavLink>
          </nav>

          <div className="header-meta">
            {meta?.generated_at ? (
              <span title="Data da última atualização dos dados">
                Atualizado em <strong>{formatDate(meta.generated_at)}</strong>
              </span>
            ) : (
              <span>Dados ainda não gerados</span>
            )}
          </div>
        </div>
      </header>

      <main className="site-main">
        <Routes>
          <Route path="/" element={<Ranking />} />
          <Route path="/calculadora" element={<Calculator />} />
          <Route path="/metodologia" element={<Methodology />} />
          <Route path="*" element={<Ranking />} />
        </Routes>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <p>
            Preços e limites: <a href="https://opencode.ai/docs/console/go">OpenCode Go</a>. Índices
            e custo por tarefa: <a href="https://artificialanalysis.ai">Artificial Analysis</a>.
          </p>
          <p>
            Projeto pessoal e informativo, sem afiliação com OpenCode ou Artificial Analysis.
            OpenCode e demais marcas pertencem aos seus respectivos proprietários. Fórmulas e
            limitações na <NavLink to="/metodologia">página de metodologia</NavLink>.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  )
}
