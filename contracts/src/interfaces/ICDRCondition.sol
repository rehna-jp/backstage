// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice CDR read condition interface.
///         The CDR precompile staticcalls this on every `read()` transaction.
///
///         Two ABI-compatible variants exist and BOTH must be implemented:
///
///         4-param (0x8db3eb17) — used by the CDR precompile on-chain:
///           checkReadCondition(uint32,bytes,bytes,address)
///
///         3-param (0x9b3e201d) — used by DKG validators for off-chain eth_call
///           condition checks before they submit partial decryptions:
///           checkReadCondition(address,bytes,bytes)
///
///         This interface declares the 4-param version as the canonical form
///         (matching the deployed LicenseReadCondition bytecode on Aeneid).
///         Implementing contracts should also add a 3-param overload.
interface ICDRReadCondition {
    /// @param uuid           CDR vault UUID being read
    /// @param accessAuxData  ABI-encoded proof supplied by the caller at read time
    /// @param conditionData  ABI-encoded config stored at vault allocation time by the creator
    /// @param caller         msg.sender of the CDR read() call (the decryptor wallet)
    /// @return               true to permit decryption, false to reject
    function checkReadCondition(
        uint32 uuid,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool);
}

/// @notice CDR write condition interface.
///         The CDR precompile staticcalls this on every `write()` transaction.
interface ICDRWriteCondition {
    /// @param caller         msg.sender of the CDR write() call
    /// @param conditionData  ABI-encoded config stored at vault allocation time
    /// @param accessAuxData  ABI-encoded proof supplied by the caller at write time
    /// @return               true to permit write, false to reject
    function checkWriteCondition(
        address caller,
        bytes calldata conditionData,
        bytes calldata accessAuxData
    ) external view returns (bool);
}
