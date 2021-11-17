import { useMemo } from "react";
import {
  GelatoStoplossOrders,
  ChainId,
  Handler,
} from "@gelatonetwork/limit-orders-lib";
import { useWeb3 } from "../../web3";

export default function useGelatoStoplossOrdersLib():
  | GelatoStoplossOrders
  | undefined {
  const { chainId, library } = useWeb3();
  console.log("chainId, librar", chainId, library?.getSigner())
  return useMemo(() => {
    try {
      return chainId && library
        ? new GelatoStoplossOrders(
          chainId as ChainId,
          library?.getSigner(),
          "quickswap_stoploss" as Handler
        )
        : undefined;
    } catch (error) {
      console.error(
        `Could not instantiate GelatoStoplossOrders: ${(error as Error).message
        }`
      );
      return undefined;
    }
  }, [chainId, library]);
}
