import { useJson } from '../lib/data'
import { formatDate } from '../lib/format'
import type { MetaFile } from '../types'

export default function Methodology() {
  const { data: meta } = useJson<MetaFile>('meta.json')

  return (
    <div className="page methodology">
      <section className="hero">
        <span className="eyebrow">Referências e metodologia</span>
        <h1>Como o ranking e a calculadora funcionam</h1>
        <p>
          Transparência antes de qualquer número: aqui estão as fontes, as fórmulas e as limitações
          deste projeto. Tudo é estático e roda no navegador — não há backend, contas ou banco de
          dados.
        </p>
      </section>

      <section className="method-section panel">
        <h2>1. Fontes de dados</h2>
        <ul>
          <li>
            <strong>OpenCode Go</strong> — catálogo de modelos, preços por milhão de tokens e limite
            mensal de cada modelo em cada plano. Endpoint público:{' '}
            <code>opencode.ai/inference/go/v1/models</code>. Planos considerados:{' '}
            <strong>Go</strong> e <strong>Go Plus</strong>.
          </li>
          <li>
            <strong>Artificial Analysis</strong> — Intelligence Index, Engineering Index e custo por
            tarefa publicado. Fonte: Data API, endpoint{' '}
            <code>/api/v2/language/models/free</code> (tier gratuito). Atribuição obrigatória:{' '}
            <a href="https://artificialanalysis.ai">artificialanalysis.ai</a>.
          </li>
        </ul>
        <p>
          A junção entre catálogos é feita por uma tabela de correspondência mantida manualmente (
          <code>mappings.json</code>), com fallback por nome normalizado. Modelos que não casam com
          a Artificial Analysis ficam de fora do ranking e aparecem na lista de excluídos.
        </p>
      </section>

      <section className="method-section panel">
        <h2>2. Consumo da franquia por tarefa</h2>
        <p>
          O limite mensal do OpenCode Go é definido em dólares de consumo e compartilhado entre os
          modelos. O peso de cada modelo na franquia é o custo da tarefa dividido pelo limite mensal
          daquele modelo:
        </p>
        <pre className="formula">
          <code>{`custo_tarefa($) = [ I × P_in + O × P_out + K × P_cache ] / 1.000.000

consumo_normalizado = custo_tarefa / limite_mensal_modelo`}</code>
        </pre>
        <p>
          Onde <code>I</code> são tokens de entrada sem cache, <code>K</code> tokens de entrada em
          cache, <code>O</code> tokens de saída e <code>P_*</code> os preços por milhão do OpenCode.
          Uma tarefa que custa US$ 1,50 num modelo com limite de US$ 15 consome 10% da franquia —
          o mesmo que US$ 6 num modelo com limite de US$ 60.
        </p>
      </section>

      <section className="method-section panel">
        <h2>3. Score do ranking</h2>
        <pre className="formula">
          <code>{`score_bruto = índice / (custo_tarefa / limite_mensal)
score_exibido = 100 × score_bruto / melhor_score_bruto`}</code>
        </pre>
        <p>
          O ranking exibe duas visões, cada uma normalizada separadamente (melhor = 100):
        </p>
        <ul>
          <li>
            <strong>Programação</strong> (principal): usa o{' '}
            <strong>Engineering Capability Index</strong> da Artificial Analysis como proxy de
            programação. O antigo Coding Index foi descontinuado pela AA e retorna sempre nulo.
          </li>
          <li>
            <strong>Geral</strong>: usa o <strong>Intelligence Index</strong>, para quem quer um
            modelo versátil.
          </li>
        </ul>
        <p>
          O ranking é recalculado para os planos Go e Go Plus, porque o limite mensal de cada modelo
          muda entre eles.
        </p>
        <p>
          <strong>Dados insuficientes nunca viram estimativa.</strong> Modelos sem índice, sem custo
          por tarefa ou sem correspondência na AA ficam fora do ranking e são listados com o motivo.
          Modelos gratuitos não entram porque não consomem franquia.
        </p>
      </section>

      <section className="method-section panel">
        <h2>4. Ajuste de preços e custo por tarefa</h2>
        <p>
          O custo por tarefa publicado pela Artificial Analysis é calculado com preços de tabela dos
          provedores. O OpenCode Go pratica esses mesmos preços na maioria dos modelos, então o valor
          é usado diretamente. Quando há diferença (por exemplo, promoções), aplicamos um fator de
          ajuste entre o preço composto do OpenCode (3 partes de entrada para 1 de saída) e o preço
          composto de referência da AA:
        </p>
        <pre className="formula">
          <code>{`custo_ajustado = custo_AA × (preço_composto_OpenCode / preço_composto_AA)
preço_composto = (3 × P_in + P_out) / 4`}</code>
        </pre>
        <p>
          Quando o fator é diferente de 1, a tabela mostra também o custo original da AA para
          conferência.
        </p>
      </section>

      <section className="method-section panel">
        <h2>5. Calculadora</h2>
        <p>
          A calculadora usa os parâmetros informados (tokens de entrada, tokens de saída e
          percentual de cache) e os preços do OpenCode para estimar:
        </p>
        <pre className="formula">
          <code>{`custo = [ I × (1 − c) × P_in + I × c × P_cache + O × P_out ] / 1.000.000

% franquia mensal = custo / limite_mensal(plano)
% janela de 5h     = custo / (0,2 × limite_mensal)
tarefas/mês        = limite_mensal / custo`}</code>
        </pre>
        <p>
          <code>c</code> é o percentual de entrada em cache. O consumo não é multiplicado entre
          modelos: a franquia é compartilhada, então os percentuais representam o uso caso apenas
          aquele modelo seja usado.
        </p>
      </section>

      <section className="method-section panel">
        <h2>6. Limitações conhecidas</h2>
        <ul>
          <li>
            Na calculadora, preços diferenciados por <strong>tamanho de contexto</strong> são
            aplicados automaticamente quando os tokens de entrada ultrapassam o limiar do modelo.
            Multiplicadores por horário (pico) e prêmio de cache write continuam fora do cálculo;
            esses modelos são marcados com <code>*</code>.
          </li>
          <li>
            O custo por tarefa da AA é uma média de uma suíte de avaliação e não representa
            exatamente o seu uso. Tarefas reais variam muito de tamanho.
          </li>
          <li>
            Engineering Index é um proxy de engenharia, não um índice específico de coding. A AA
            descontinuou Coding e Agentic Index; o Coding Agent Index atual mede agentes completos e
            exige o tier pago da API.
          </li>
          <li>
            A correspondência de modelos é manual (<code>mappings.json</code>). Modelos novos podem
            ficar fora do ranking até ganharem um mapeamento e índices na AA.
          </li>
          <li>
            A AA publica variantes de esforço (Max, High etc.) como entradas separadas. O mapeamento
            escolhe explicitamente a variante principal de cada modelo; variantes sem índice não
            são usadas como substitutas para não comparar configurações diferentes.
          </li>
          <li>
            O selo <strong>treina dados</strong> reflete o campo <code>training</code> do catálogo
            do OpenCode Go (por exemplo, Muse Spark Contributor e Iceman Contributor Free). Ele não
            altera o score, mas é relevante para privacidade.
          </li>
          <li>
            Arredondamentos são aplicados apenas na exibição. O JSON mantém os valores calculados.
          </li>
        </ul>
      </section>

      <section className="method-section panel">
        <h2>7. Atualização dos dados</h2>
        <p>
          Um GitHub Action roda diariamente (06:00 UTC), baixa as duas fontes, recalcula os rankings
          e grava os arquivos <code>public/data/*.json</code>. Se a coleta falhar, nada é
          sobrescrito e o site continua com a última versão válida.
        </p>
        {meta?.generated_at && (
          <p className="subtle">
            Última atualização: <strong>{formatDate(meta.generated_at)}</strong>.
            {meta.counts && (
              <>
                {' '}
                {meta.counts.opencode_models} modelos no catálogo, {meta.counts.matched} com dados da
                AA, {meta.counts.ranked_coding} no ranking de programação e{' '}
                {meta.counts.ranked_general} no geral (plano Go).
              </>
            )}
          </p>
        )}
      </section>
    </div>
  )
}
