import { useMemo, useState } from 'react'
import { activePriceOverride, pricesForContext, requestCost } from '../lib/calc'
import { useJson } from '../lib/data'
import { formatLimit, formatPct, formatTasks, formatTokens, formatUsd } from '../lib/format'
import type { ModelsFile, OpenCodeModel, Plan, PriceOverride } from '../types'
import { PLAN_LABELS } from '../types'

interface Row {
  model: OpenCodeModel
  prices: Pick<OpenCodeModel['prices'], 'input' | 'output' | 'cache_read'>
  override: PriceOverride | null
  cost: number
  limit: number | null
  pct: number | null
  fiveHourPct: number | null
  tasks: number | null
}

function toNumber(value: string): number {
  const parsed = Number(value.replace(',', '.'))
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

export default function Calculator() {
  const { data, error, loading } = useJson<ModelsFile>('models.json')
  const [plan, setPlan] = useState<Plan>('go')
  const [tokensIn, setTokensIn] = useState('150000')
  const [tokensOut, setTokensOut] = useState('15000')
  const [cachePct, setCachePct] = useState('75')

  const { paidRows, freeModels } = useMemo(() => {
    if (!data) return { paidRows: [] as Row[], freeModels: [] as OpenCodeModel[] }

    const input = toNumber(tokensIn)
    const output = toNumber(tokensOut)
    const cache = Math.min(100, toNumber(cachePct))

    const paid: Row[] = []
    const free: OpenCodeModel[] = []

    for (const model of data.models) {
      if (model.monthly_usage === null) {
        free.push(model)
        continue
      }

      const overrides = model.price_overrides ?? []
      const prices = pricesForContext(model.prices, overrides, input)
      const cost = requestCost(input, output, cache, prices)
      const limit = model.monthly_usage[plan]
      const hasLimit = limit !== null && limit > 0

      paid.push({
        model,
        prices,
        override: activePriceOverride(overrides, input),
        cost,
        limit,
        pct: hasLimit ? cost / limit : null,
        fiveHourPct: hasLimit ? cost / (limit * 0.2) : null,
        tasks: hasLimit && cost > 0 ? limit / cost : null,
      })
    }

    free.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    paid.sort((a, b) => (a.pct ?? Number.POSITIVE_INFINITY) - (b.pct ?? Number.POSITIVE_INFINITY))

    return { paidRows: paid, freeModels: free }
  }, [data, plan, tokensIn, tokensOut, cachePct])

  const cacheValue = Math.min(100, toNumber(cachePct))

  return (
    <div className="page">
      <section className="hero">
        <span className="eyebrow">Calculadora de franquia</span>
        <h1>Quanto da franquia compartilhada cada modelo consumiria?</h1>
        <p>
          Informe o tamanho típico de uma tarefa. O cálculo usa os preços do OpenCode Go e o limite
          mensal de cada modelo para estimar o custo em dólares e a fração da franquia consumida.
        </p>
      </section>

      <div className="panel calc-panel">
        <div className="panel-head">
          <h2>Parâmetros da tarefa</h2>
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

        <div className="calc-grid">
          <label className="field">
            <span className="field-label">Tokens de entrada</span>
            <input
              inputMode="numeric"
              min={0}
              step={1000}
              type="number"
              value={tokensIn}
              onChange={(event) => setTokensIn(event.target.value)}
            />
            <span className="field-hint">Contexto enviado ao modelo na tarefa.</span>
          </label>

          <label className="field">
            <span className="field-label">Tokens de saída</span>
            <input
              inputMode="numeric"
              min={0}
              step={1000}
              type="number"
              value={tokensOut}
              onChange={(event) => setTokensOut(event.target.value)}
            />
            <span className="field-hint">Inclui raciocínio (reasoning) gerado.</span>
          </label>

          <label className="field">
            <span className="field-label">Entrada em cache (%)</span>
            <input
              inputMode="numeric"
              max={100}
              min={0}
              step={5}
              type="number"
              value={cachePct}
              onChange={(event) => setCachePct(event.target.value)}
            />
            <span className="field-hint">Parte dos tokens de entrada lida do cache.</span>
          </label>
        </div>

        <p className="calc-summary">
          {formatTokens(toNumber(tokensIn))} tokens de entrada · {formatTokens(toNumber(tokensOut))}{' '}
          de saída · {cacheValue.toLocaleString('pt-BR')}% em cache. O preço de cache do OpenCode
          costuma ser muito menor que o preço de entrada.
        </p>
      </div>

      {loading && <div className="panel empty-state">Carregando catálogo…</div>}

      {!loading && (error || !data) && (
        <div className="panel empty-state">
          <h2>Não foi possível carregar o catálogo</h2>
          <p>{error ?? 'Arquivo models.json ausente.'}</p>
          <pre className="formula">
            <code>{'docker compose run --rm update npm run update:data -- --skip-aa'}</code>
          </pre>
        </div>
      )}

      {!loading && data && (
        <>
          <div className="panel">
            <div className="panel-head">
              <h2>Comparativo por modelo · {PLAN_LABELS[plan]}</h2>
              <span className="subtle">{paidRows.length} modelos pagos · ordenados por consumo</span>
            </div>
            <div className="table-wrap">
              <table className="data-table calc-table">
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th className="num">Custo da tarefa</th>
                    <th className="num">Franquia mensal</th>
                    <th className="num hide-sm">Janela de 5h</th>
                    <th className="num hide-sm">Tarefas/mês</th>
                  </tr>
                </thead>
                <tbody>
                  {paidRows.map((row, index) => (
                    <tr key={row.model.id} className={index < 3 ? 'is-best' : undefined}>
                      <td>
                        <div className="model-name">
                          {row.model.name}
                          {row.model.has_pricing_complexity && (
                            <span
                              className="asterisk"
                              title="Multiplicadores horários e prêmio de cache write não são considerados."
                            >
                              *
                            </span>
                          )}
                          {row.model.training && (
                            <span
                              className="badge badge-warn"
                              title="O OpenCode Go indica que este modelo pode usar seus dados para treinamento."
                            >
                              treina dados
                            </span>
                          )}
                        </div>
                        <div className="model-id">
                          in {formatUsd(row.prices.input)} · out {formatUsd(row.prices.output)} ·
                          cache {formatUsd(row.prices.cache_read)} /1M
                        </div>
                        {row.override && (
                          <div className="model-id override-note">
                            acima de {formatTokens(row.override.context_gt)} tokens de entrada:
                            preço de contexto aplicado
                          </div>
                        )}
                      </td>
                      <td className="num mono">{formatUsd(row.cost)}</td>
                      <td className="num mono">
                        {row.pct === null ? '—' : formatPct(row.pct, 3)}
                        {row.limit !== null && (
                          <div className="subtle">limite {formatLimit(row.limit)}</div>
                        )}
                      </td>
                      <td className="num mono hide-sm">
                        {row.fiveHourPct === null ? '—' : formatPct(row.fiveHourPct, 2)}
                      </td>
                      <td className="num mono hide-sm">
                        {row.tasks === null ? '—' : formatTasks(row.tasks)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {freeModels.length > 0 && (
            <div className="panel free-panel">
              <div className="panel-head">
                <h2>Modelos gratuitos</h2>
                <span className="subtle">não consomem franquia</span>
              </div>
              <div className="free-chips">
                {freeModels.map((model) => (
                  <span className="free-chip" key={model.id}>
                    {model.name}
                    <em>grátis</em>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="legend">
            <p>
              A franquia do Go é compartilhada entre modelos e medida em dólares de consumo. O
              consumo de uma tarefa é o custo dividido pelo limite mensal do modelo. Janela de 5h =
              20% e semanal = 50% do limite mensal.
            </p>
            <p>
              * Multiplicadores por horário (pico) e prêmio de cache write não são considerados.
              Preços diferenciados por tamanho de contexto são aplicados automaticamente quando os
              tokens de entrada ultrapassam o limiar do modelo.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
