import Link from "next/link"
import { redirect } from "next/navigation"
import { ArrowRight, Wallet } from "lucide-react"

import { DashboardShell } from "@/components/dashboard/dashboard-shell"
import { DashboardHeader } from "@/components/dashboard/investor-overview/dashboard-header"
import { ContractSummaryCard } from "@/components/dashboard/driver-hire-purchase/contract-summary-card"
import { DriverPaymentForm } from "@/components/dashboard/driver-hire-purchase/driver-payment-form"
import { DriverPaymentsTable } from "@/components/dashboard/driver-hire-purchase/driver-payments-table"
import { DriverVirtualAccountCard } from "@/components/dashboard/driver-hire-purchase/driver-virtual-account-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import dbConnect from "@/lib/dbConnect"
import { getSessionFromCookies } from "@/lib/auth/session"
import { getDriverContract, getDriverPayments } from "@/lib/services/driver-contracts.service"
import { getOrProvisionDriverVirtualAccount } from "@/lib/services/paystack-dva.service"
import { isMockPaymentsRuntimeAllowed } from "@/lib/services/paystack-mock.service"
import User from "@/models/User"

export const dynamic = "force-dynamic"

function resolveDisplayName(user: { fullName?: string; name?: string; email?: string | null }) {
  if (user.fullName && user.fullName.trim()) return user.fullName.trim()
  if (user.name && user.name.trim()) return user.name.trim()
  if (user.email) return user.email.split("@")[0]
  return "Driver"
}

export default async function DriverRepaymentPage() {
  const session = await getSessionFromCookies()
  if (!session?.userId) {
    redirect("/signin")
  }

  await dbConnect()
  const user = await User.findById(session.userId)
    .select("name fullName email role")

  if (!user || user.role !== "driver") {
    redirect("/signin")
  }

  const contract = await getDriverContract(user._id.toString())
  if (!contract) {
    return (
      <DashboardShell
        role="driver"
        sidebarWidth="compact"
        header={
          <DashboardHeader
            title="Make Payment"
            welcomeName={resolveDisplayName({
              fullName: user.fullName,
              name: user.name,
              email: user.email,
            })}
          />
        }
      >
        <main className="p-4 md:p-6">
          <Card className="rounded-[10px] border border-border/70 bg-card">
            <CardHeader>
              <CardTitle>No Active Contract</CardTitle>
              <CardDescription>
                A repayment contract must be assigned before you can make payments.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline">
                <Link href="/dashboard/driver">Back to dashboard</Link>
              </Button>
            </CardContent>
          </Card>
        </main>
      </DashboardShell>
    )
  }

  const recentPayments = await getDriverPayments({
    driverUserId: user._id.toString(),
    contractId: contract.id,
    limit: 12,
  })

  let virtualAccount:
    | {
        accountNumber: string
        accountName: string
        bankName: string
        providerSlug?: string | null
        status: "PENDING" | "ACTIVE" | "FAILED" | "INACTIVE"
        isMock?: boolean
        mockReference?: string | null
      }
    | null = null
  let virtualAccountError: string | null = null
  const showMockSimulator = isMockPaymentsRuntimeAllowed()

  try {
    const provisionedAccount = await getOrProvisionDriverVirtualAccount({
      driverUserId: user._id.toString(),
      contractId: contract.id,
    })

    if (provisionedAccount.accountNumber && provisionedAccount.accountName && provisionedAccount.bankName) {
      virtualAccount = {
        accountNumber: provisionedAccount.accountNumber,
        accountName: provisionedAccount.accountName,
        bankName: provisionedAccount.bankName,
        providerSlug: provisionedAccount.providerSlug,
        status: provisionedAccount.status,
        isMock: provisionedAccount.isMock,
        mockReference: provisionedAccount.mockReference,
      }
    }
  } catch (error) {
    virtualAccountError = error instanceof Error ? error.message : "Unable to provision a dedicated repayment account."
  }

  return (
    <DashboardShell
      role="driver"
      sidebarWidth="compact"
      header={
        <DashboardHeader
          title="Make Payment"
          welcomeName={resolveDisplayName({
            fullName: user.fullName,
            name: user.name,
            email: user.email,
          })}
        />
      }
    >
      <main className="min-w-0 space-y-4 p-4 md:p-6">
        <section className="rounded-[10px] border border-border/70 bg-card px-4 py-4 md:px-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-xl font-semibold leading-tight text-foreground md:text-2xl">Repayment Center</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Make weekly fiat NGN repayments for your hire-purchase contract.
              </p>
            </div>
            <Button asChild variant="outline" className="h-10 w-full sm:w-auto">
              <Link href="/dashboard/driver/payments">
                Payment History
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <ContractSummaryCard contract={contract} />
          <DriverVirtualAccountCard
            account={virtualAccount}
            errorMessage={virtualAccountError}
            remainingBalanceNgn={contract.remainingBalanceNgn}
            nextPaymentAmountNgn={contract.nextPaymentAmountNgn || contract.weeklyPaymentNgn}
            showMockSimulator={showMockSimulator}
          />
        </section>

        <section className="rounded-[10px] border border-dashed border-border/70 bg-card/70 p-4 md:p-5">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-foreground">Paystack Checkout Fallback</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Use checkout only if your banking app cannot complete a transfer to the dedicated repayment account above.
            </p>
          </div>
          <DriverPaymentForm
            contractId={contract.id}
            defaultAmountNgn={contract.nextPaymentAmountNgn || contract.weeklyPaymentNgn}
            maxAmountNgn={contract.remainingBalanceNgn}
            defaultEmail={user.email || ""}
            nextDueDate={contract.nextDueDate}
            title="Fallback Card / Checkout Payment"
            description="Use Paystack checkout if you cannot transfer to the dedicated account."
            submitLabel="Continue to Paystack Checkout"
            className="border-0 bg-transparent p-0 shadow-none"
          />
        </section>

        <section className="rounded-[10px] border border-border/70 bg-card p-4 md:p-5">
          <div className="mb-4 inline-flex items-center text-sm text-muted-foreground">
            <Wallet className="mr-2 h-4 w-4" />
            Recent repayments are listed below after webhook confirmation or checkout verification.
          </div>
          <DriverPaymentsTable payments={recentPayments} emptyLabel="No repayment transactions yet." />
        </section>
      </main>
    </DashboardShell>
  )
}
