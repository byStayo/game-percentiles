// Omen Prediction Market Integration
// Creates permissionless markets on Gnosis Chain for games with edge signals

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Lazy load ethers only when needed for blockchain operations
let ethers: any = null
async function getEthers() {
  if (!ethers) {
    const module = await import("https://esm.sh/ethers@6.9.0")
    ethers = module
  }
  return ethers
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Gnosis Chain (xDAI) Configuration
const GNOSIS_RPC = "https://rpc.gnosischain.com"
const CHAIN_ID = 100

// Contract Addresses on Gnosis Chain
const CONTRACTS = {
  conditionalTokens: "0xCeAfDD6bc0bEF976fdCd1112955828E00543c0Ce",
  fpmmFactory: "0x9083A2B699c0a4AD06F63580BDE2635d26a3eeF0",
  realitio: "0x90a617ed516ab7fAaBA56CcEDA0C5D952f294d03",
  realitioOracleAdapter: "0x2bf1BFb0eB6276a4F4B60044068Cb8CdEB89f79B",
  wxdai: "0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d", // Wrapped xDAI (collateral)
}

// ABIs (minimal for our use case)
const CONDITIONAL_TOKENS_ABI = [
  "function prepareCondition(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external",
  "function getConditionId(address oracle, bytes32 questionId, uint256 outcomeSlotCount) external pure returns (bytes32)",
  "function getCollectionId(bytes32 parentCollectionId, bytes32 conditionId, uint256 indexSet) external view returns (bytes32)",
  "function getPositionId(address collateralToken, bytes32 collectionId) external pure returns (uint256)",
  "event ConditionPreparation(bytes32 indexed conditionId, address indexed oracle, bytes32 indexed questionId, uint256 outcomeSlotCount)",
]

const FPMM_FACTORY_ABI = [
  "function createFixedProductMarketMaker(address conditionalTokens, address collateralToken, bytes32[] conditionIds, uint256 fee) external returns (address)",
  "function create2FixedProductMarketMaker(uint256 saltNonce, address conditionalTokens, address collateralToken, bytes32[] conditionIds, uint256 fee, uint256 initialFunds, uint256[] distributionHint) external returns (address)",
  "event FixedProductMarketMakerCreation(address indexed creator, address fixedProductMarketMaker, address conditionalTokens, address collateralToken, bytes32[] conditionIds, uint256 fee)",
]

const REALITIO_ABI = [
  "function askQuestion(uint256 template_id, string question, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce) external payable returns (bytes32)",
  "function askQuestionWithMinBond(uint256 template_id, string question, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce, uint256 min_bond) external payable returns (bytes32)",
  "event LogNewQuestion(bytes32 indexed question_id, address indexed user, uint256 template_id, string question, bytes32 indexed content_hash, address arbitrator, uint32 timeout, uint32 opening_ts, uint256 nonce, uint256 created)",
]

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
]

// Kleros arbitrator on Gnosis Chain
const KLEROS_ARBITRATOR = "0xe40DD83a262da3f56976038F1554Fe541Fa75ecd"

// Realitio template IDs
const REALITIO_TEMPLATES = {
  BOOL: 0,        // Yes/No questions
  UINT: 1,        // Number questions
  SINGLE_SELECT: 2, // Multiple choice (single)
  MULTI_SELECT: 3,  // Multiple choice (multi)
}

interface MarketParams {
  question: string
  category: string
  outcomes: string[]
  resolutionDate: Date
  initialLiquidityXdai: number
  fee: number // basis points (e.g., 200 = 2%)
}

interface EdgeSignal {
  game_id: string
  home_team: string
  away_team: string
  game_date: string
  dk_total_line: number
  dk_line_percentile: number
  p05: number
  p95: number
  sport_id: string
  signal_type: 'OVER' | 'UNDER'
  edge_strength: 'STRONG' | 'MODERATE' | 'WEAK'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, dry_run = true } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (action) {
      case 'get-signals':
        return await getSignals(supabase)

      case 'list-markets':
        return await listCreatedMarkets(supabase)

      case 'create-markets':
      case 'check-balance': {
        // Only load ethers for blockchain operations
        const eth = await getEthers()

        const privateKey = Deno.env.get('OMEN_PRIVATE_KEY')
        if (!privateKey && !dry_run && action === 'create-markets') {
          throw new Error('OMEN_PRIVATE_KEY not configured')
        }

        const provider = new eth.JsonRpcProvider(GNOSIS_RPC)
        const wallet = privateKey ? new eth.Wallet(privateKey, provider) : null

        if (action === 'create-markets') {
          return await createMarketsForSignals(supabase, wallet, provider, dry_run, eth)
        } else {
          return await checkBalance(wallet, provider, eth)
        }
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use: get-signals, create-markets, check-balance, list-markets' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
  } catch (error: any) {
    console.error('Error:', error)
    const message = error?.message || error?.toString() || JSON.stringify(error) || 'Unknown error'
    return new Response(
      JSON.stringify({ error: message, details: error }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})

async function getSignals(supabase: any) {
  // Get today's games with strong edge signals
  const today = new Date().toISOString().split('T')[0]
  console.log('Getting signals for date:', today)

  const { data: edges, error } = await supabase
    .from('daily_edges')
    .select(`
      game_id,
      dk_total_line,
      dk_line_percentile,
      p05,
      p95,
      sport_id,
      games!inner(
        id,
        game_date,
        home_team,
        away_team,
        status
      )
    `)
    .gte('games.game_date', today)
    .not('dk_line_percentile', 'is', null)
    .or('dk_line_percentile.lte.25,dk_line_percentile.gte.75')
    .order('dk_line_percentile', { ascending: true })

  console.log('Query result - edges:', edges?.length || 0, 'error:', error?.message || 'none')
  if (error) throw error

  const signals: EdgeSignal[] = (edges || []).map((edge: any) => {
    const percentile = edge.dk_line_percentile
    const isOver = percentile <= 25

    let strength: 'STRONG' | 'MODERATE' | 'WEAK' = 'WEAK'
    if (percentile <= 5 || percentile >= 95) strength = 'STRONG'
    else if (percentile <= 15 || percentile >= 85) strength = 'MODERATE'

    return {
      game_id: edge.game_id,
      home_team: edge.games.home_team,
      away_team: edge.games.away_team,
      game_date: edge.games.game_date,
      dk_total_line: edge.dk_total_line,
      dk_line_percentile: percentile,
      p05: edge.p05,
      p95: edge.p95,
      sport_id: edge.sport_id,
      signal_type: isOver ? 'OVER' : 'UNDER',
      edge_strength: strength,
    }
  })

  return new Response(
    JSON.stringify({
      success: true,
      date: today,
      signals_count: signals.length,
      strong_signals: signals.filter(s => s.edge_strength === 'STRONG').length,
      moderate_signals: signals.filter(s => s.edge_strength === 'MODERATE').length,
      signals,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function createMarketsForSignals(
  supabase: any,
  wallet: any,
  provider: any,
  dryRun: boolean,
  eth: any
) {
  // Get signals
  const signalsResponse = await getSignals(supabase)
  const signalsData = await signalsResponse.json()

  if (!signalsData.success) {
    throw new Error('Failed to get signals')
  }

  const signals: EdgeSignal[] = signalsData.signals
  const results: any[] = []

  // Filter to only STRONG signals for market creation
  const strongSignals = signals.filter(s => s.edge_strength === 'STRONG')

  for (const signal of strongSignals) {
    try {
      const marketParams = buildMarketParams(signal)

      if (dryRun) {
        results.push({
          signal,
          market_params: marketParams,
          status: 'dry_run',
          would_create: true,
        })
      } else {
        // Check if market already exists
        const { data: existing } = await supabase
          .from('omen_markets')
          .select('id')
          .eq('game_id', signal.game_id)
          .maybeSingle()

        if (existing) {
          results.push({
            signal,
            status: 'skipped',
            reason: 'market_exists',
          })
          continue
        }

        // Create the market on-chain
        const marketResult = await createMarketOnChain(wallet!, provider, marketParams, eth)

        // Store in database
        await supabase.from('omen_markets').insert({
          game_id: signal.game_id,
          question: marketParams.question,
          condition_id: marketResult.conditionId,
          question_id: marketResult.questionId,
          fpmm_address: marketResult.fpmmAddress,
          collateral_token: CONTRACTS.wxdai,
          initial_liquidity: marketParams.initialLiquidityXdai,
          fee_bps: marketParams.fee,
          resolution_date: marketParams.resolutionDate.toISOString(),
          signal_type: signal.signal_type,
          edge_percentile: signal.dk_line_percentile,
          dk_line: signal.dk_total_line,
          tx_hash: marketResult.txHash,
        })

        results.push({
          signal,
          market: marketResult,
          status: 'created',
        })
      }
    } catch (error) {
      results.push({
        signal,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      dry_run: dryRun,
      total_signals: signals.length,
      strong_signals: strongSignals.length,
      markets_processed: results.length,
      results,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

function buildMarketParams(signal: EdgeSignal): MarketParams {
  const gameDate = new Date(signal.game_date)
  const resolutionDate = new Date(gameDate)
  resolutionDate.setHours(resolutionDate.getHours() + 6) // 6 hours after game start

  const sportName = getSportName(signal.sport_id)
  const question = `Will the total points in ${signal.away_team} @ ${signal.home_team} (${sportName}) on ${gameDate.toLocaleDateString()} be OVER ${signal.dk_total_line}?`

  return {
    question,
    category: `sports-${signal.sport_id}`,
    outcomes: ['Yes', 'No'],
    resolutionDate,
    initialLiquidityXdai: 10, // $10 initial liquidity
    fee: 200, // 2% fee
  }
}

function getSportName(sportId: string): string {
  const sports: Record<string, string> = {
    'nba': 'NBA',
    'nfl': 'NFL',
    'nhl': 'NHL',
    'mlb': 'MLB',
  }
  return sports[sportId] || sportId.toUpperCase()
}

async function createMarketOnChain(
  wallet: any,
  provider: any,
  params: MarketParams,
  eth: any
): Promise<{
  questionId: string
  conditionId: string
  fpmmAddress: string
  txHash: string
}> {
  // Contract instances
  const realitio = new eth.Contract(CONTRACTS.realitio, REALITIO_ABI, wallet)
  const conditionalTokens = new eth.Contract(CONTRACTS.conditionalTokens, CONDITIONAL_TOKENS_ABI, wallet)
  const fpmmFactory = new eth.Contract(CONTRACTS.fpmmFactory, FPMM_FACTORY_ABI, wallet)
  const wxdai = new eth.Contract(CONTRACTS.wxdai, ERC20_ABI, wallet)

  // Step 1: Create Realitio question
  const openingTimestamp = Math.floor(params.resolutionDate.getTime() / 1000)
  const timeout = 86400 // 24 hours for answers
  const nonce = Date.now()

  // Format question for Realitio (template 0 = bool)
  const realitioQuestion = `${params.question}␟${params.category}␟en_US`

  console.log('Creating Realitio question...')
  const questionTx = await realitio.askQuestionWithMinBond(
    REALITIO_TEMPLATES.BOOL,
    realitioQuestion,
    KLEROS_ARBITRATOR,
    timeout,
    openingTimestamp,
    nonce,
    eth.parseEther("0.01"), // Min bond 0.01 xDAI
    { value: 0 }
  )
  const questionReceipt = await questionTx.wait()

  // Extract question ID from logs
  const questionLog = questionReceipt.logs.find((log: any) => {
    try {
      const parsed = realitio.interface.parseLog(log)
      return parsed?.name === 'LogNewQuestion'
    } catch { return false }
  })
  const questionId = questionLog ? realitio.interface.parseLog(questionLog)?.args.question_id : null
  if (!questionId) throw new Error('Failed to get question ID')

  console.log('Question ID:', questionId)

  // Step 2: Prepare condition on Conditional Tokens
  const outcomeSlotCount = params.outcomes.length

  console.log('Preparing condition...')
  const conditionTx = await conditionalTokens.prepareCondition(
    CONTRACTS.realitioOracleAdapter,
    questionId,
    outcomeSlotCount
  )
  await conditionTx.wait()

  // Calculate condition ID
  const conditionId = await conditionalTokens.getConditionId(
    CONTRACTS.realitioOracleAdapter,
    questionId,
    outcomeSlotCount
  )
  console.log('Condition ID:', conditionId)

  // Step 3: Approve WXDAI spending
  const liquidityWei = eth.parseEther(params.initialLiquidityXdai.toString())

  console.log('Approving WXDAI...')
  const approveTx = await wxdai.approve(CONTRACTS.fpmmFactory, liquidityWei)
  await approveTx.wait()

  // Step 4: Create FPMM with initial liquidity
  const feeBps = BigInt(params.fee) * BigInt(10) ** BigInt(14) // Convert basis points to 18 decimals
  const distributionHint = params.outcomes.map(() => BigInt(1)) // Equal distribution

  console.log('Creating FPMM...')
  const fpmmTx = await fpmmFactory.create2FixedProductMarketMaker(
    nonce,
    CONTRACTS.conditionalTokens,
    CONTRACTS.wxdai,
    [conditionId],
    feeBps,
    liquidityWei,
    distributionHint
  )
  const fpmmReceipt = await fpmmTx.wait()

  // Extract FPMM address from logs
  const fpmmLog = fpmmReceipt.logs.find((log: any) => {
    try {
      const parsed = fpmmFactory.interface.parseLog(log)
      return parsed?.name === 'FixedProductMarketMakerCreation'
    } catch { return false }
  })
  const fpmmAddress = fpmmLog ? fpmmFactory.interface.parseLog(fpmmLog)?.args.fixedProductMarketMaker : null
  if (!fpmmAddress) throw new Error('Failed to get FPMM address')

  console.log('FPMM Address:', fpmmAddress)

  return {
    questionId,
    conditionId,
    fpmmAddress,
    txHash: fpmmReceipt.hash,
  }
}

async function checkBalance(wallet: any, provider: any, eth: any) {
  if (!wallet) {
    return new Response(
      JSON.stringify({ error: 'Wallet not configured. Add OMEN_PRIVATE_KEY to secrets.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }

  const wxdai = new eth.Contract(CONTRACTS.wxdai, ERC20_ABI, provider)

  const xdaiBalance = await provider.getBalance(wallet.address)
  const wxdaiBalance = await wxdai.balanceOf(wallet.address)

  return new Response(
    JSON.stringify({
      success: true,
      address: wallet.address,
      xdai_balance: eth.formatEther(xdaiBalance),
      wxdai_balance: eth.formatEther(wxdaiBalance),
      chain: 'Gnosis Chain',
      chain_id: CHAIN_ID,
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function listCreatedMarkets(supabase: any) {
  const { data: markets, error } = await supabase
    .from('omen_markets')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw error

  return new Response(
    JSON.stringify({
      success: true,
      markets_count: markets?.length || 0,
      markets: (markets || []).map((m: any) => ({
        ...m,
        omen_url: `https://omen.eth.limo/#/${m.fpmm_address}`,
      })),
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
