// Credit Line Fintech Solution — Phase 21: Rust High-Velocity clearing House Processor
// Verifies double-entry ledger invariants and reconciles transactions 
// between fiat currency bank ledgers and Web3 on-chain smart contracts.

#[no_mangle]
pub extern "C" fn verify_ledger_invariant(
    fiat_total: f64,
    onchain_total: f64,
    tolerance: f64,
) -> bool {
    let diff = (fiat_total - onchain_total).abs();
    diff <= tolerance
}

#[no_mangle]
pub extern "C" fn reconcile_clearing_balances_json(
    fiat_total: f64,
    onchain_total: f64,
    tolerance: f64,
) -> *mut std::os::raw::c_char {
    use std::ffi::CString;

    let diff = (fiat_total - onchain_total).abs();
    let reconciled = diff <= tolerance;

    let json_result = format!(
        "{{\"success\":true,\"fiat_total\":{:.2},\"onchain_total\":{:.2},\"absolute_difference\":{:.5},\"reconciled\":{},\"tolerance\":{:.4}}}",
        fiat_total, onchain_total, diff, reconciled, tolerance
    );

    let c_str = CString::new(json_result).unwrap();
    c_str.into_raw()
}
