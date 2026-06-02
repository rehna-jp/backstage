// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ICDRReadCondition} from "./interfaces/ICDRCondition.sol";

/// @title  TimeWindowedReadCondition
/// @notice CDR read condition that layers time-based access windows on top of
///         any inner ICDRReadCondition (typically TieredLicenseReadCondition).
///
///         Two windows are supported:
///
///         Early access  [earlyAt, releaseAt)
///           Caller must hold at least one token from `subscriptionNft`.
///           If earlyAt == 0 or subscriptionNft == address(0), early access
///           is disabled for this vault.
///
///         Public window [releaseAt, ∞)
///           Any caller whose accessAuxData satisfies the inner condition.
///
///         Outside both windows the condition returns false (vault locked).
///
///         ┌─ conditionData ────────────────────────────────────────────────────┐
///         │  abi.encode(                                                       │
///         │    address  tieredReadCond,   // inner ICDRReadCondition           │
///         │    bytes    tieredCondData,   // conditionData forwarded to inner  │
///         │    uint256  earlyAt,          // early-access start (0 = disabled) │
///         │    uint256  releaseAt,        // public-access start               │
///         │    address  subscriptionNft   // ERC-721 subscriber pass           │
///         │  )                                                                 │
///         └────────────────────────────────────────────────────────────────────┘
///         accessAuxData is forwarded unchanged to the inner condition.
///
///         Like TieredLicenseReadCondition this contract implements BOTH the
///         4-param (0x8db3eb17) and 3-param (0x9b3e201d) interfaces so it works
///         with both the CDR precompile and the DKG validator off-chain checks.
///
///         Deploy once; reuse across drops.
contract TimeWindowedReadCondition is ICDRReadCondition {
    /// @notice 4-param version — selector 0x8db3eb17.
    ///         Called by the CDR precompile during on-chain read() validation.
    function checkReadCondition(
        uint32 uuid,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool) {
        return _check(uuid, caller, conditionData, accessAuxData);
    }

    /// @notice 3-param version — selector 0x9b3e201d.
    ///         Called by DKG validators for off-chain condition verification.
    function checkReadCondition(
        address caller,
        bytes calldata conditionData,
        bytes calldata accessAuxData
    ) external view returns (bool) {
        return _check(0, caller, conditionData, accessAuxData);
    }

    function _check(
        uint32 uuid,
        address caller,
        bytes calldata conditionData,
        bytes calldata accessAuxData
    ) internal view returns (bool) {
        (
            address tieredReadCond,
            bytes memory tieredCondData,
            uint256 earlyAt,
            uint256 releaseAt,
            address subscriptionNft
        ) = abi.decode(conditionData, (address, bytes, uint256, uint256, address));

        // Public window: open to all callers who satisfy the inner tier condition.
        if (block.timestamp >= releaseAt) {
            return ICDRReadCondition(tieredReadCond).checkReadCondition(
                uuid, accessAuxData, tieredCondData, caller
            );
        }

        // Early-access window: subscribers only.
        if (
            earlyAt > 0 &&
            block.timestamp >= earlyAt &&
            subscriptionNft != address(0) &&
            IERC721(subscriptionNft).balanceOf(caller) > 0
        ) {
            return ICDRReadCondition(tieredReadCond).checkReadCondition(
                uuid, accessAuxData, tieredCondData, caller
            );
        }

        return false;
    }
}
