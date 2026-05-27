// Credit Line Fintech Solution — Phase 16: Rust Global FX & CBDC Liquidity Router
// Evaluates real-time currency conversion rates, tokenized liquidity pools, and CBDC networks
// to determine the mathematically cheapest, sub-3-second multi-hop transfer path.

use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct CurrencyHop {
    pub from: String,
    pub to: String,
    pub rate: f64,
    pub fee_percentage: f64,
    pub network: String, // "SWIFT", "CBDC_Sovereign", "Stellar_Pool", "Ripple_Net"
}

pub struct FxLiquidityRouter {
    pub hops: Vec<CurrencyHop>,
}

impl FxLiquidityRouter {
    pub fn new() -> Self {
        // Initialize mock global fx rails
        let mut hops = Vec::new();
        
        // Direct routes
        hops.push(CurrencyHop { from: "INR".to_string(), to: "USD".to_string(), rate: 0.012, fee_percentage: 0.015, network: "SWIFT".to_string() });
        hops.push(CurrencyHop { from: "USD".to_string(), to: "EUR".to_string(), rate: 0.92, fee_percentage: 0.012, network: "SWIFT".to_string() });
        hops.push(CurrencyHop { from: "INR".to_string(), to: "EUR".to_string(), rate: 0.011, fee_percentage: 0.018, network: "SWIFT".to_string() });

        // CBDC & Tokenized Liquidity rails (highly efficient)
        hops.push(CurrencyHop { from: "INR".to_string(), to: "e-RUPI".to_string(), rate: 1.0, fee_percentage: 0.001, network: "CBDC_Sovereign".to_string() });
        hops.push(CurrencyHop { from: "e-RUPI".to_string(), to: "USDC".to_string(), rate: 0.0121, fee_percentage: 0.002, network: "Stellar_Pool".to_string() });
        hops.push(CurrencyHop { from: "USDC".to_string(), to: "EUR".to_string(), rate: 0.922, fee_percentage: 0.001, network: "Ripple_Net".to_string() });
        hops.push(CurrencyHop { from: "USDC".to_string(), to: "Digital-Euro".to_string(), rate: 0.923, fee_percentage: 0.0015, network: "CBDC_Sovereign".to_string() });
        hops.push(CurrencyHop { from: "Digital-Euro".to_string(), to: "EUR".to_string(), rate: 1.0, fee_percentage: 0.0005, network: "CBDC_Sovereign".to_string() });
        
        FxLiquidityRouter { hops }
    }

    pub fn find_cheapest_route(&self, source: &str, target: &str, amount: f64) -> Option<(Vec<String>, f64, f64, Vec<String>)> {
        // Direct Route calculation
        let mut best_net_amount = 0.0;
        let mut best_path = Vec::new();
        let mut best_networks = Vec::new();
        let mut total_fees = 0.0;

        // Simple BFS to find 1-hop or 2-hop or 3-hop routes
        // Check 1-hop direct route
        for hop1 in &self.hops {
            if hop1.from == source && hop1.to == target {
                let fee = amount * hop1.fee_percentage;
                let net_val = (amount - fee) * hop1.rate;
                if net_val > best_net_amount {
                    best_net_amount = net_val;
                    best_path = vec![source.to_string(), target.to_string()];
                    best_networks = vec![hop1.network.clone()];
                    total_fees = fee;
                }
            }
        }

        // Check 2-hop route: Source -> Mid1 -> Target
        for hop1 in &self.hops {
            if hop1.from == source {
                for hop2 in &self.hops {
                    if hop2.from == hop1.to && hop2.to == target {
                        let fee1 = amount * hop1.fee_percentage;
                        let amt_mid = (amount - fee1) * hop1.rate;
                        let fee2 = amt_mid * hop2.fee_percentage;
                        let net_val = (amt_mid - fee2) * hop2.rate;
                        if net_val > best_net_amount {
                            best_net_amount = net_val;
                            best_path = vec![source.to_string(), hop1.to.clone(), target.to_string()];
                            best_networks = vec![hop1.network.clone(), hop2.network.clone()];
                            total_fees = fee1 + (fee2 / hop1.rate); // Total fees in source currency
                        }
                    }
                }
            }
        }

        // Check 3-hop route: Source -> Mid1 -> Mid2 -> Target
        for hop1 in &self.hops {
            if hop1.from == source {
                for hop2 in &self.hops {
                    if hop2.from == hop1.to {
                        for hop3 in &self.hops {
                            if hop3.from == hop2.to && hop3.to == target {
                                let fee1 = amount * hop1.fee_percentage;
                                let amt_mid1 = (amount - fee1) * hop1.rate;
                                
                                let fee2 = amt_mid1 * hop2.fee_percentage;
                                let amt_mid2 = (amt_mid1 - fee2) * hop2.rate;
                                
                                let fee3 = amt_mid2 * hop3.fee_percentage;
                                let net_val = (amt_mid2 - fee3) * hop3.rate;

                                if net_val > best_net_amount {
                                    best_net_amount = net_val;
                                    best_path = vec![
                                        source.to_string(),
                                        hop1.to.clone(),
                                        hop2.to.clone(),
                                        target.to_string()
                                    ];
                                    best_networks = vec![hop1.network.clone(), hop2.network.clone(), hop3.network.clone()];
                                    // Aggregate fee calculation projected in source currency
                                    total_fees = fee1 + (fee2 / hop1.rate) + (fee3 / (hop1.rate * hop2.rate));
                                }
                            }
                        }
                    }
                }
            }
        }

        if best_path.is_empty() {
            None
        } else {
            Some((best_path, best_net_amount, total_fees, best_networks))
        }
    }
}

// FFI export hooks for Python compatibility integrations
#[no_mangle]
pub extern "C" fn get_optimal_fx_route(
    source_currency: *const libc::c_char,
    target_currency: *const libc::c_char,
    amount: f64,
) -> *mut libc::c_char {
    // Boilerplate for FFI conversion
    use std::ffi::{CStr, CString};
    use std::os::raw::c_char;

    if source_currency.is_null() || target_currency.is_null() {
        return std::ptr::null_mut();
    }

    let c_str_src = unsafe { CStr::from_ptr(source_currency) };
    let c_str_tgt = unsafe { CStr::from_ptr(target_currency) };

    let src = c_str_src.to_str().unwrap_or("INR");
    let tgt = c_str_tgt.to_str().unwrap_or("EUR");

    let router = FxLiquidityRouter::new();
    if let Some((path, net, fees, nets)) = router.find_cheapest_route(src, tgt, amount) {
        let json_result = format!(
            "{{\"success\":true,\"path\":{:?},\"net_amount\":{},\"fees\":{},\"networks\":{:?}}}",
            path, net, fees, nets
        );
        let c_str_res = CString::new(json_result).unwrap();
        c_str_res.into_raw()
    } else {
        let c_str_err = CString::new("{\"success\":false,\"error\":\"No route found\"}").unwrap();
        c_str_err.into_raw()
    }
}
