import React from "react";
import { gelatoReducers } from "./state";
import ApplicationUpdater from "./state/gapplication/updater";
import ListsUpdater from "./state/glists/updater";
import MulticallUpdater from "./state/gmulticall/updater";
import { ThemeProvider, DefaultTheme } from "styled-components";
import {
  useGelatoLimitOrders,
  useGelatoLimitOrdersHandlers,
} from "./hooks/gelato";
import useGelatoLimitOrdersHistory from "./hooks/gelato/useGelatoLimitOrdersHistory";
import GelatoLimitOrder from "./components/GelatoLimitOrder";
import { Web3Provider } from "./web3";
export * from "@gelatonetwork/limit-orders-lib";

export function GelatoProvider({
  chainId,
  library,
  children,
  theme,
  account,
}: {
  chainId: number | undefined;
  library: any | undefined;
  account: string | undefined;
  theme: DefaultTheme;
  children?: React.ReactNode;
}) {
  return (
    <ThemeProvider theme={theme}>
      <Web3Provider chainId={chainId} library={library} account={account}>
        <ListsUpdater />
        <ApplicationUpdater />
        <MulticallUpdater />
        {children}
      </Web3Provider>
    </ThemeProvider>
  );
}

export {
  useGelatoLimitOrders,
  useGelatoLimitOrdersHandlers,
  useGelatoLimitOrdersHistory,
  GelatoLimitOrder as GelatoLimitOrderPanel,
  gelatoReducers,
};
