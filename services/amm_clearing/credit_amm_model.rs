// Credit Line Fintech Solution — Phase 20: Rust Algorithmic Credit AMM Curve
// Calculates dynamic borrowing rates across cross-border liquidity pools 
// using pool utilization ratios, kink targets, and slope rate modifiers.

#[no_mangle]
pub extern "C" fn calculate_interest_rate_ffi(
    total_borrowed: f64,
    total_liquidity: f64,
    base_rate: f64,
    slope1: f64,
    slope2: f64,
    kink: f64,
) -> f64 {
    // If there is no liquidity, utilization is zero
    let u_t = if total_liquidity <= 0.0 {
        0.0
    } else {
        total_borrowed / total_liquidity
    };

    // Cap utilization at 100% (1.0)
    let u_t_capped = if u_t > 1.0 { 1.0 } else { u_t };

    // Calculate dynamic borrowing rate
    // Formula: R_t = R_0 + (U_t * slope1) + max(0, U_t - U_kink) * slope2
    let excess = if u_t_capped > kink {
        u_t_capped - kink
    } else {
        0.0
    };

    base_rate + (u_t_capped * slope1) + (excess * slope2)
}

#[no_mangle]
pub extern "C" fn get_amm_pool_rate_json(
    total_borrowed: f64,
    total_liquidity: f64,
    base_rate: f64,
    slope1: f64,
    slope2: f64,
    kink: f64,
) -> *mut std::os::raw::c_char {
    use std::ffi::CString;

    let u_t = if total_liquidity <= 0.0 {
        0.0
    } else {
        total_borrowed / total_liquidity
    };
    let u_t_capped = if u_t > 1.0 { 1.0 } else { u_t };
    let excess = if u_t_capped > kink { u_t_capped - kink } else { 0.0 };
    let rate = base_rate + (u_t_capped * slope1) + (excess * slope2);

    let json_result = format!(
        "{{\"success\":true,\"utilization\":{:.5},\"base_rate\":{:.4},\"rate\":{:.4},\"kink_active\":{}}}",
        u_t_capped, base_rate, rate, u_t_capped > kink
    );

    let c_str = CString::new(json_result).unwrap();
    c_str.into_raw()
}
