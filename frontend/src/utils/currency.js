export const getCurrencySymbol = (company) => {
  return company === 'inpack' ? '₹' : 'AED';
};

export const formatCurrency = (amount, company) => {
  const symbol = getCurrencySymbol(company);
  const numericAmount = parseFloat(amount || 0);
  
  if (company === 'inpack') {
    return `${symbol} ${numericAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
  } else {
    // AED is usually formatted with the symbol after or before, let's keep it consistent
    return `${symbol} ${numericAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
  }
};
