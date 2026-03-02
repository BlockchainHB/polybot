import { TradeDecision, RiskCheckResult, AgentConfig } from "@/src/types";

export function checkRisk(
  decision: TradeDecision,
  currentExposure: number,
  config: AgentConfig
): RiskCheckResult {
  if (decision.confidence < config.minConfidence) {
    return {
      approved: false,
      reason: `Confidence ${decision.confidence} below minimum ${config.minConfidence}`,
    };
  }

  if (decision.suggestedSize > config.maxTradeSize) {
    return {
      approved: false,
      reason: `Suggested size $${decision.suggestedSize} exceeds max trade size $${config.maxTradeSize}`,
    };
  }

  // Check available wallet balance
  const tradeCost = decision.suggestedSize * decision.suggestedPrice;
  if (tradeCost > config.availableBalance) {
    return {
      approved: false,
      reason: `Trade cost $${tradeCost.toFixed(2)} exceeds available balance $${config.availableBalance.toFixed(2)}`,
    };
  }

  let adjustedSize = decision.suggestedSize;
  const remainingExposure = config.maxTotalExposure - currentExposure;

  if (currentExposure + adjustedSize > config.maxTotalExposure) {
    adjustedSize = Math.floor(remainingExposure * 100) / 100;
  }

  // Also cap by available balance
  const maxAffordableSize = config.availableBalance / decision.suggestedPrice;
  if (adjustedSize > maxAffordableSize) {
    adjustedSize = Math.floor(maxAffordableSize * 100) / 100;
  }

  if (adjustedSize < 0.5) {
    return {
      approved: false,
      reason: `Adjusted size $${adjustedSize.toFixed(2)} is below minimum $0.50 (${
        config.availableBalance < 0.5
          ? "insufficient balance"
          : "exposure limit reached"
      })`,
    };
  }

  return {
    approved: true,
    adjustedSize,
  };
}
