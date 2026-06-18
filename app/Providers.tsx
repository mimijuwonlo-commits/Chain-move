"use client"

import type { FC, ReactNode } from "react"
import { liskSepolia } from "viem/chains"

import { PrivyProvider } from "@/lib/privy/react-auth"
import { WalletProvider } from "@/contexts/wallet-context"
import { getStellarConfig } from "@/lib/stellar/config"
import type { WalletNetwork } from "@/types/wallet"

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

function getDefaultNetwork(): WalletNetwork {
  const stellarConfig = getStellarConfig()
  return stellarConfig.network.toLowerCase() === "mainnet" ? "stellar-mainnet" : "stellar-testnet"
}

export const Providers: FC<{ children: ReactNode }> = ({ children }) => {
  const defaultNetwork = getDefaultNetwork()

  return (
    <PrivyProvider
      appId={privyAppId || ""}
      config={{
        loginMethods: ["email", "sms"],
        supportedChains: [liskSepolia],
        defaultChain: liskSepolia,
        embeddedWallets: {
          ethereum: {
            createOnLogin: "all-users",
          },
          showWalletUIs: true,
        },
        appearance: {
          theme: "light",
          accentColor: "#F2780E",
          logo: "/images/chainmovelogo.png",
        },
      }}
    >
      <WalletProvider defaultNetwork={defaultNetwork}>
        {children}
      </WalletProvider>
    </PrivyProvider>
  )
}
