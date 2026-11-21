import { useMemo, useState } from 'react'
import { useJson } from '../lib/data'
import { formatDate, formatLimit, formatPct, formatUsd } from '../lib/format'
import type { Plan, RankingFile, RankingViewKey } from '../types'
import { PLAN_LABELS } from '../types'

const VIEW_COPY: Record<
  RankingViewKey,
  { label: string; indexName: string; description: string }
> = {
  coding: {
    label: 'Programação',
    indexName: 'Engineering Index',
    description:
      'Ordena os modelos pela capacidade em engenharia (Engineering Index da Artificial Analysis) por unidade de franquia consumida.',
  },
  general: {
    label: 'Geral',
    indexName: 'Intelligence Index',
    description:
      'Ordena os modelos pela inteligência geral (Intelligence Index da Artificial Analysis) por unidade de franquia consumida.',
  },
}

function EmptyState({ error }: { error: string | null }) {
  return (
    <div className="panel empty-state">
      <h2>Ranking ainda não foi gerado</h2>
      <p>
        Os arquivos de dados diários ainda não existem{error ? ` (${error})` : ''}. Configure a
        chave gratuita da Artificial Analysis e rode a atualização:
      </p>
      <pre className="formula">
        <code>{'# .env\nAA_API_KEY=sua_chave\n\ndocker compose run --rm update'}</code>
      </pre>
      <p className="subtle">
        No GitHub, a atualização roda sozinha todos os dias via GitHub Actions. A calculadora já
        funciona com o catálogo do OpenCode mesmo sem esse passo.
      </p>
    </div>
  )
}

export default function Ranking() {
  const { data, error, loading } = useJson<RankingFile>('ranking.json')
  const [plan, setPlan] = useState<Plan>('go')
  const [view, setView] = useState<RankingViewKey>('coding')

  const entries = useMemo(() => data?.plans?.[plan]?.[view] ?? [], [data, plan, view])
  const excluded = useMemo(() => data?.excluded?.[view] ?? [], [data, view])
  const top = entries.slice(0, 10)
  const copy = VIEW_COPY[view]

  return (
    <div className="page">
      <section className="hero">
        <span className="eyebrow">Ranking · eficiência de franquia</span>
        <h1>Quanta inteligência cabe na sua franquia do OpenCode Go?</h1>
        <p>
          Score = índice de inteligência dividido pela fração da franquia mensal consumida por
          tarefa. Quanto maior, melhor: o modelo entrega mais capacidade com menos uso do seu
          limite compartilhado.
        </p>
        <div className="hero-chips">
          <span className="chip">Índices: Artificial Analysis</span>
          <span className="chip">Preços e limites: OpenCode Go</span>
          {data?.generated_at && (
            <span className="chip chip-muted">Dados de {formatDate(data.generated_at)}</span>
          )}
        </div>
      </section>

      <div className="toolbar">
        <div className="toolbar-group">
          <span className="toolbar-label">Plano</span>
          <div className="toggle-group" role="group" aria-label="Plano">
            {(Object.keys(PLAN_LABELS) as Plan[]).map((key) => (
              <button
                key={key}
                type="button"
                className={plan === key ? 'toggle is-active' : 'toggle'}
                onClick={() => setPlan(key)}
              >
                {PLAN_LABELS[key]}
              </button>
            ))}
          </div>
        </div>

        <div className="toolbar-group">
          <span className="toolbar-label">Índice</span>
          <div className="toggle-group" role="group" aria-label="Índice do ranking">
            {(Object.keys(VIEW_COPY) as RankingViewKey[]).map((key) => (
              <button
                key={key}
                type="button"
                className={view === key ? 'toggle is-active' : 'toggle'}
                onClick={() => setView(key)}
              >
                {VIEW_COPY[key].label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="view-description">{copy.description}</p>

      {loading && <div className="panel empty-state">Carregando dados…</div>}

      {!loading && (!data || entries.length === 0) && <EmptyState error={error} />}

      {!loading && data && entries.length > 0 && (
        <>
          <div className="panel">
            <div className="panel-head">
              <h2>
                Top {Math.min(10, entries.length)} · {copy.label}
              </h2>
              <span className="subtle">
                {entries.length} modelos ranqueados · plano {PLAN_LABELS[plan]}
              </span>
            </div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th aria-label="Posição">#</th>
                    <th>Modelo</th>
                    <th className="num">Score</th>
                    <th className="num">
                      {copy.indexName.replace(' Index', '')}
                      <span className="th-suffix"> /100</span>
                    </th>
                    <th className="num hide-sm">Custo/tarefa*</th>
                    <th className="num">Limite/mês</th>
                    <th className="num">Franquia/tarefa</th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((model, index) => (
                    <tr key={model.id}>
                      <td>
                        <span className={index < 3 ? `rank rank-${index + 1}` : 'rank'}>
                          {index + 1}
                        </span>
                      </td>
                      <td>
                        <div className="model-name">
                          {model.name}
                          {model.training && (
                            <span
                              className="badge badge-warn"
                              title="O OpenCode Go indica que este modelo pode usar seus dados para treinamento."
                            >
                              treina dados
                            </span>
                          )}
                        </div>
                        <div className="model-id">{model.id}</div>
                      </td>
                      <td className="num">
                        <div className="score">
                          <span className="mono">{model.score.toFixed(1)}</span>
                          <span className="score-bar" aria-hidden="true">
                            <i style={{ width: `${model.score}%` }} />
                          </span>
                        </div>
                      </td>
                      <td className="num mono">{model.index.toFixed(1)}</td>
                      <td className="num hide-sm">
                        <div className="mono">{formatUsd(model.cost_per_task_opencode)}</div>
                        {model.adjustment_factor !== 1 && (
                          <div className="subtle" title="Custo publicado pela AA, antes do ajuste de preços">
                            AA {formatUsd(model.cost_per_task_aa)}
                          </div>
                        )}
                      </td>
                      <td className="num mono">{formatLimit(model.monthly_limit)}</td>
                      <td className="num mono">{formatPct(model.franchise_pct_per_task)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="legend">
            <p>
              * Custo por tarefa calculado pela Artificial Analysis e ajustado aos preços do
              OpenCode Go quando diferem (ex.: promoções). Score 100 = melhor modelo desta visão e
              plano. Empates de arredondamento são possíveis.
            </p>
          </div>

          {excluded.length > 0 && (
            <details className="excluded">
              <summary>
                {excluded.length} modelo{excluded.length > 1 ? 's' : ''} fora deste ranking
              </summary>
              <ul>
                {excluded.map((item) => (
                  <li key={item.id}>
                    <strong>{item.name}</strong> — {item.reason}
                  </li>
                ))}
              </ul>
              <p className="subtle excluded-note">
                Modelos gratuitos aparecem na calculadora, mas não no ranking porque não consomem
                franquia. Regra aplicada a todos: dados insuficientes nunca viram score estimado.
              </p>
            </details>
          )}
        </>
      )}
    </div>
  )
}
