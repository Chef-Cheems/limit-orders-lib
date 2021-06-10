/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  Currency,
  CurrencyAmount,
  Percent,
  TradeType,
} from "@uniswap/sdk-core";
import { Trade } from "@uniswap/v2-sdk";
import { AdvancedSwapDetails } from "../order/AdvancedSwapDetails";
import UnsupportedCurrencyFooter from "../order/UnsupportedCurrencyFooter";
import { MouseoverTooltipContent } from "../Tooltip";
import React, { useCallback, useState, Fragment } from "react";
import { ArrowDown, Info, Divide, X } from "react-feather";
import { Text } from "rebass";
import styled from "styled-components";
import { ButtonError, ButtonGray, ButtonLight, ButtonPrimary } from "../Button";
import { GreyCard } from "../Card";
import { AutoColumn } from "../Column";
import CurrencyInputPanel from "../CurrencyInputPanel";
import Row, { RowFixed } from "../Row";
import confirmPriceImpactWithoutFee from "../order/confirmPriceImpactWithoutFee";
import ConfirmSwapModal from "../order/ConfirmSwapModal";
import {
  ArrowWrapper,
  BottomGrouping,
  Dots,
  SwapCallbackError,
  Wrapper,
} from "../order/styleds";
import SwapHeader from "../order/SwapHeader";
import TradePrice from "../order/TradePrice";
import { useGelatoLimitOrders } from "../../hooks/gelato";
import { useIsSwapUnsupported } from "../../hooks/useIsSwapUnsupported";
import { useUSDCValue } from "../../hooks/useUSDCPrice";
import { Field } from "../../state/gorder/actions";
import { tryParseAmount } from "../../state/gorder/hooks";
import { computeFiatValuePriceImpact } from "../../utils/computeFiatValuePriceImpact";
import { maxAmountSpend } from "../../utils/maxAmountSpend";
import AppBody from "./AppBody";
import { TYPE } from "../../theme";
import { useWeb3 } from "../../web3";
import useTheme from "../../hooks/useTheme";
import LimitOrdersHistory from "../LimitOrdersHistory";
import useGasOverhead from "../../hooks/useGasOverhead";
// import PoweredByGelato from "../../assets/svg/poweredbygelato.svg";
// import PoweredByGelatoBlack from "../../assets/svg/poweredbygelato_black.svg";
// import PoweredByGelatoWhite from "../../assets/svg/poweredbygelato_white.svg";

const StyledInfo = styled(Info)`
  opacity: 0.4;
  color: ${({ theme }) => theme.text1};
  height: 16px;
  width: 16px;
  :hover {
    opacity: 0.8;
  }
`;

enum Rate {
  DIV = "DIV",
  MUL = "MUL",
}

// const StyledPoweredByGelato = styled(PoweredByGelato)`
//   margin: 0 0.25rem 0 0.35rem;
//   height: 35%;
//   path {
//     stroke-width: 1.5px;
//   }
// `;

// const StyledPoweredByGelatoBlack = styled(PoweredByGelatoBlack)`
//   margin: 0 0.25rem 0 0.35rem;
//   height: 35%;
//   path {
//     stroke-width: 1.5px;
//   }
// `;

// const StyledPoweredByGelatoWhite = styled(PoweredByGelatoWhite)`
//   margin: 0 0.25rem 0 0.35rem;
//   height: 5%;
//   border-radius: 3px;
//   width: 80px;
//   path {
//     stroke-width: 1.5px;
//     border-radius: 3px;
//   }
// `;

export default function GelatoLimitOrder() {
  const { account } = useWeb3();

  const theme = useTheme();

  const recipient = account ?? null;

  const {
    handlers: {
      handleInput,
      handleRateType,
      handleCurrencySelection,
      handleSwitchTokens,
      handleLimitOrderSubmission,
    },
    derivedOrderInfo: {
      parsedAmounts,
      currencies,
      currencyBalances,
      trade,
      inputError,
      price,
    },
    orderState: { independentField, rateType, typedValue },
  } = useGelatoLimitOrders();

  const fiatValueInput = useUSDCValue(parsedAmounts.input);
  const fiatValueOutput = useUSDCValue(parsedAmounts.output);
  const desiredRateInCurrencyAmount = tryParseAmount(
    trade?.outputAmount.toSignificant(6),
    currencies.output
  );

  const fiatValueDesiredRate = useUSDCValue(desiredRateInCurrencyAmount);
  const priceImpact = computeFiatValuePriceImpact(
    fiatValueInput,
    fiatValueOutput
  );
  const currentMarketRate = trade?.executionPrice.toSignificant(6) ?? undefined;

  const isValid = !inputError;

  const handleTypeInput = useCallback(
    (value: string) => {
      handleInput(Field.INPUT, value);
    },
    [handleInput]
  );
  const handleTypeOutput = useCallback(
    (value: string) => {
      handleInput(Field.OUTPUT, value);
    },
    [handleInput]
  );
  const handleTypeDesiredRate = useCallback(
    (value: string) => {
      handleInput(Field.PRICE, value);
    },
    [handleInput]
  );

  // modal and loading
  const [
    { showConfirm, tradeToConfirm, swapErrorMessage, attemptingTxn, txHash },
    setSwapState,
  ] = useState<{
    showConfirm: boolean;
    tradeToConfirm: Trade<Currency, Currency, TradeType> | undefined;
    attemptingTxn: boolean;
    swapErrorMessage: string | undefined;
    txHash: string | undefined;
  }>({
    showConfirm: false,
    tradeToConfirm: undefined,
    attemptingTxn: false,
    swapErrorMessage: undefined,
    txHash: undefined,
  });

  const allowedSlippage = new Percent(40, 10_000);
  const userHasSpecifiedInputOutput = Boolean(
    (independentField === Field.INPUT || independentField === Field.OUTPUT) &&
      currencies.input &&
      currencies.output
    // &&
    // parsedAmounts[independentField]?.greaterThan(JSBI.BigInt(0))
  );
  const routeNotFound = !trade?.route;
  const isLoadingRoute = parsedAmounts.input && !trade; //V3TradeState.LOADING === v3TradeState

  const maxInputAmount: CurrencyAmount<Currency> | undefined = maxAmountSpend(
    currencyBalances.input
  );
  const showMaxButton = Boolean(
    maxInputAmount?.greaterThan(0) &&
      !parsedAmounts.input?.equalTo(maxInputAmount)
  );

  const handleSwap = useCallback(() => {
    if (!handleLimitOrderSubmission) {
      return;
    }

    if (priceImpact && !confirmPriceImpactWithoutFee(priceImpact)) {
      return;
    }

    setSwapState({
      attemptingTxn: true,
      tradeToConfirm,
      showConfirm,
      swapErrorMessage: undefined,
      txHash: undefined,
    });

    handleLimitOrderSubmission()
      .then((hash) => {
        setSwapState({
          attemptingTxn: false,
          tradeToConfirm,
          showConfirm,
          swapErrorMessage: undefined,
          txHash: hash,
        });
      })
      .catch((error) => {
        setSwapState({
          attemptingTxn: false,
          tradeToConfirm,
          showConfirm,
          swapErrorMessage: error.message,
          txHash: undefined,
        });
      });
  }, [priceImpact, handleLimitOrderSubmission, tradeToConfirm, showConfirm]);

  // errors
  const [showInverted, setShowInverted] = useState<boolean>(false);

  const handleConfirmDismiss = useCallback(() => {
    setSwapState({
      showConfirm: false,
      tradeToConfirm,
      attemptingTxn,
      swapErrorMessage,
      txHash,
    });
    // if there was a tx hash, we want to clear the input
    if (txHash) {
      handleInput(Field.INPUT, "");
    }
  }, [attemptingTxn, handleInput, swapErrorMessage, tradeToConfirm, txHash]);

  const handleAcceptChanges = useCallback(() => {
    setSwapState({
      tradeToConfirm: trade as any,
      swapErrorMessage,
      txHash,
      attemptingTxn,
      showConfirm,
    });
  }, [attemptingTxn, showConfirm, swapErrorMessage, trade, txHash]);

  const handleInputSelect = useCallback(
    (inputCurrency) => {
      //  setApprovalSubmitted(false); // reset 2 step UI for approvals
      handleCurrencySelection(Field.INPUT, inputCurrency);
    },
    [handleCurrencySelection]
  );

  const handleMaxInput = useCallback(() => {
    maxInputAmount && handleInput(Field.INPUT, maxInputAmount.toExact());
  }, [maxInputAmount, handleInput]);

  const handleOutputSelect = useCallback(
    (outputCurrency) => handleCurrencySelection(Field.OUTPUT, outputCurrency),
    [handleCurrencySelection]
  );

  const swapIsUnsupported = useIsSwapUnsupported(
    currencies?.input,
    currencies?.output
  );

  const { gasPrice, realExecutionRate } = useGasOverhead(
    parsedAmounts.input,
    parsedAmounts.output,
    rateType
  );

  const formattedAmounts = {
    input:
      independentField === Field.INPUT
        ? typedValue
        : parsedAmounts.input?.toSignificant(6) ?? "",
    output:
      independentField === Field.OUTPUT
        ? typedValue
        : parsedAmounts.output?.toSignificant(6) ?? "",
    price:
      independentField === Field.PRICE
        ? typedValue
        : price?.toSignificant(6) ?? "",
  };

  return (
    <Fragment>
      <AppBody>
        <SwapHeader />
        <Wrapper id="limit-order-page">
          <ConfirmSwapModal
            isOpen={showConfirm}
            trade={trade as any}
            originalTrade={tradeToConfirm}
            onAcceptChanges={handleAcceptChanges}
            attemptingTxn={attemptingTxn}
            txHash={txHash}
            recipient={recipient}
            allowedSlippage={allowedSlippage}
            onConfirm={handleSwap}
            swapErrorMessage={swapErrorMessage}
            onDismiss={handleConfirmDismiss}
          />

          <AutoColumn gap={"md"}>
            <div style={{ display: "relative" }}>
              <CurrencyInputPanel
                label={
                  independentField === Field.OUTPUT ? "From (at most)" : "From"
                }
                value={formattedAmounts.input}
                showMaxButton={showMaxButton}
                currency={currencies.input}
                onUserInput={handleTypeInput}
                onMax={handleMaxInput}
                fiatValue={fiatValueInput ?? undefined}
                onCurrencySelect={handleInputSelect}
                otherCurrency={currencies.output}
                showCommonBases={true}
                id="limit-order-currency-input"
              />
              <ArrowWrapper clickable>
                {rateType === Rate.MUL ? (
                  <X
                    size="16"
                    onClick={handleRateType}
                    color={
                      currencies.input && currencies.output
                        ? theme.text1
                        : theme.text3
                    }
                  />
                ) : (
                  <Divide
                    size="16"
                    onClick={handleRateType}
                    color={
                      currencies.input && currencies.output
                        ? theme.text1
                        : theme.text3
                    }
                  />
                )}
              </ArrowWrapper>
              <CurrencyInputPanel
                value={formattedAmounts.price}
                currentMarketRate={currentMarketRate}
                showMaxButton={showMaxButton}
                currency={currencies.input}
                onUserInput={handleTypeDesiredRate}
                fiatValue={fiatValueDesiredRate ?? undefined}
                onCurrencySelect={handleInputSelect}
                otherCurrency={currencies.output}
                showCommonBases={true}
                id="limit-order-currency-rate"
                showCurrencySelector={false}
                hideBalance={true}
                showRate={true}
                isInvertedRate={rateType === Rate.MUL ? false : true}
                gasPrice={gasPrice}
                realExecutionRate={realExecutionRate}
              />
              <ArrowWrapper clickable>
                <ArrowDown
                  size="16"
                  onClick={() => {
                    //   setApprovalSubmitted(false); // reset 2 step UI for approvals
                    handleSwitchTokens();
                  }}
                  color={
                    currencies.input && currencies.output
                      ? theme.text1
                      : theme.text3
                  }
                />
              </ArrowWrapper>
              <CurrencyInputPanel
                value={formattedAmounts.output}
                onUserInput={handleTypeOutput}
                label={
                  independentField === Field.INPUT ? "To (at least)" : "To"
                }
                showMaxButton={false}
                hideBalance={false}
                fiatValue={fiatValueOutput ?? undefined}
                priceImpact={priceImpact}
                currency={currencies.output}
                onCurrencySelect={handleOutputSelect}
                otherCurrency={currencies.input}
                showCommonBases={true}
                id="limit-order-currency-output"
              />
            </div>

            <Row
              style={{ justifyContent: !trade ? "center" : "space-between" }}
            >
              <RowFixed>
                <ButtonGray
                  width="fit-content"
                  padding="0.1rem 0.5rem"
                  disabled
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    height: "24px",
                    opacity: 0.4,
                    marginLeft: "0.25rem",
                  }}
                >
                  <TYPE.black fontSize={12}>Powered by Gelato🍦</TYPE.black>
                </ButtonGray>
              </RowFixed>
              {trade ? (
                <RowFixed>
                  <TradePrice
                    price={trade.executionPrice as any}
                    showInverted={showInverted}
                    setShowInverted={setShowInverted}
                  />
                  <MouseoverTooltipContent
                    content={
                      <AdvancedSwapDetails
                        trade={trade as any}
                        allowedSlippage={allowedSlippage}
                      />
                    }
                  >
                    <StyledInfo />
                  </MouseoverTooltipContent>
                </RowFixed>
              ) : null}
            </Row>

            <BottomGrouping>
              {swapIsUnsupported ? (
                <ButtonPrimary disabled={true}>
                  <TYPE.main mb="4px">Unsupported Asset</TYPE.main>
                </ButtonPrimary>
              ) : !account ? (
                <ButtonLight>Connect Wallet</ButtonLight>
              ) : routeNotFound &&
                userHasSpecifiedInputOutput &&
                parsedAmounts.input ? (
                <GreyCard style={{ textAlign: "center" }}>
                  <TYPE.main mb="4px">
                    {isLoadingRoute ? (
                      <Dots>Loading</Dots>
                    ) : (
                      `Insufficient liquidity for this trade.`
                    )}
                  </TYPE.main>
                </GreyCard>
              ) : priceImpact?.greaterThan("0") ? (
                <GreyCard style={{ textAlign: "center" }}>
                  <TYPE.main mb="4px">{`Only possible to place orders above market rate`}</TYPE.main>
                </GreyCard>
              ) : (
                <ButtonError
                  onClick={() => {
                    setSwapState({
                      tradeToConfirm: trade as any,
                      attemptingTxn: false,
                      swapErrorMessage: undefined,
                      showConfirm: true,
                      txHash: undefined,
                    });
                  }}
                  id="limit-order-button"
                  disabled={!isValid}
                  error={false}
                >
                  <Text fontSize={20} fontWeight={500}>
                    {inputError ? inputError : `Place order`}
                  </Text>
                </ButtonError>
              )}
              {swapErrorMessage && isValid ? (
                <SwapCallbackError error={swapErrorMessage} />
              ) : null}
            </BottomGrouping>
          </AutoColumn>
        </Wrapper>
      </AppBody>

      <LimitOrdersHistory />
      {!swapIsUnsupported ? null : (
        <UnsupportedCurrencyFooter
          show={swapIsUnsupported}
          currencies={[currencies.input, currencies.output]}
        />
      )}
    </Fragment>
  );
}
