// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ICDRReadCondition} from "./interfaces/ICDRCondition.sol";
import {ILicenseToken} from "./interfaces/ILicenseToken.sol";

/// @title  TieredLicenseReadCondition
/// @notice CDR read condition that gates a vault to holders of a Story Protocol
///         license token minted for a *specific* License Terms ID on a specific
///         IP Asset. This enables per-tier content gating within a single IP:
///         Stream, Download, and Commercial tiers each get their own vault,
///         each locked to a different License Terms ID.
///
/// @dev    The standard LicenseReadCondition deployed on Aeneid accepts any
///         license token for a given IP Asset (no terms-ID check). This contract
///         extends that pattern with tier discrimination.
///
///         ┌─ conditionData (set once at vault allocation) ─────────────────┐
///         │  abi.encode(address licenseToken, address ipId,                │
///         │             uint256 requiredTermsId)                           │
///         └────────────────────────────────────────────────────────────────┘
///         ┌─ accessAuxData (supplied by the caller at every read) ─────────┐
///         │  abi.encode(uint256[] tokenIds)                                │
///         └────────────────────────────────────────────────────────────────┘
///
///         The condition returns true if the caller presents at least one
///         license token that satisfies all four requirements:
///           1. caller is the ERC-721 owner of the token
///           2. token was minted for the required IP Asset
///           3. token encodes the required License Terms ID
///           4. token has not been revoked
///
///         This contract is stateless and immutable. Deploy one instance and
///         reuse it for every tier / IP Asset combination by varying
///         conditionData at allocation time.
///
///         See: piplabs/cdr-sdk docs/CONDITIONS.md for the condition interface spec.
///              storyprotocol/protocol-core-v1 contracts/interfaces/ILicenseToken.sol
contract TieredLicenseReadCondition is ICDRReadCondition {
    /// @dev Cap on token IDs per read call. Prevents gas exhaustion through
    ///      unbounded external call loops; one matching token is always enough.
    uint256 private constant MAX_TOKEN_IDS = 10;

    /// @inheritdoc ICDRReadCondition
    /// @dev      The CDR precompile staticcalls this function; it must not modify state.
    ///           ownerOf() is wrapped in try/catch because OZ v5 reverts with
    ///           ERC721NonexistentToken for non-existent IDs — we skip those
    ///           rather than letting the revert propagate and block the read tx.
    function checkReadCondition(
        address caller,
        bytes calldata conditionData,
        bytes calldata accessAuxData
    ) external view returns (bool) {
        (address licenseToken, address ipId, uint256 requiredTermsId) =
            abi.decode(conditionData, (address, address, uint256));

        uint256[] memory tokenIds = abi.decode(accessAuxData, (uint256[]));

        uint256 len = tokenIds.length;
        if (len == 0) return false;
        if (len > MAX_TOKEN_IDS) len = MAX_TOKEN_IDS;

        ILicenseToken lt = ILicenseToken(licenseToken);

        for (uint256 i = 0; i < len; ) {
            uint256 tokenId = tokenIds[i];

            // ownerOf reverts for non-existent tokens (OZ v5 ERC721NonexistentToken).
            // Catch and skip so a stale or fabricated ID never blocks the whole check.
            address owner;
            try lt.ownerOf(tokenId) returns (address _owner) {
                owner = _owner;
            } catch {
                unchecked { ++i; }
                continue;
            }

            if (
                owner == caller &&
                lt.getLicensorIpId(tokenId) == ipId &&
                lt.getLicenseTermsId(tokenId) == requiredTermsId &&
                !lt.isLicenseTokenRevoked(tokenId)
            ) {
                return true;
            }

            unchecked { ++i; }
        }

        return false;
    }
}
