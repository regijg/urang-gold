/**
 * Net profit = gross profit + repair income + forfeited order deposits - operating expenses.
 * All amounts are whole-rupiah strings from the database and may be negative (a loss),
 * so BigInt is used directly instead of the input parsers.
 */
export function netProfit(grossProfit: string, repairIncome: string, orderForfeit: string, expenseTotal: string): string {
  return (BigInt(grossProfit) + BigInt(repairIncome) + BigInt(orderForfeit) - BigInt(expenseTotal)).toString();
}
