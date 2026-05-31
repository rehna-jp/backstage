// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice CDR read condition interface.
///         The CDR precompile staticcalls this on every `read()` transaction
///         for vaults that use a contract read condition.
///
///         Source of truth: piplabs/cdr-sdk docs/CONDITIONS.md
///         Parameter order: (caller, conditionData, accessAuxData) — three params, no uuid.
interface ICDRReadCondition {
    /// @param caller         msg.sender of the CDR read() call (the decryptor wallet)
    /// @param conditionData  ABI-encoded config stored at vault allocation time by the creator
    /// @param accessAuxData  ABI-encoded proof supplied by the caller at read time
    /// @return               true to permit decryption, false to reject
    function checkReadCondition(
        address caller,
        bytes calldata conditionData,
        bytes calldata accessAuxData
    ) external view returns (bool);
}

/// @notice CDR write condition interface.
///         The CDR precompile staticcalls this on every `write()` transaction
///         for vaults that use a contract write condition.
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
