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
///         This contract implements BOTH the 4-param interface (0x8db3eb17,
///         used by the CDR precompile on-chain) and the 3-param interface
///         (0x9b3e201d, used by DKG validators for their off-chain eth_call
///         condition checks). Both dispatch to the same internal logic.
///
///         This contract is stateless and immutable. Deploy one instance and
///         reuse it for every tier / IP Asset combination by varying
///         conditionData at allocation time.
contract TieredLicenseReadCondition is ICDRReadCondition {
    /// @dev Cap on token IDs per read call. Prevents gas exhaustion through
    ///      unbounded external call loops; one matching token is always enough.
    uint256 private constant MAX_TOKEN_IDS = 10;

    /// @notice 4-param version — selector 0x8db3eb17.
    ///         Called by the CDR precompile during on-chain read() validation.
    function checkReadCondition(
        uint32 /* uuid */,
        bytes calldata accessAuxData,
        bytes calldata conditionData,
        address caller
    ) external view returns (bool) {
        return _check(caller, conditionData, accessAuxData);
    }

    /// @notice 3-param version — selector 0x9b3e201d.
    ///         Called by DKG validators for off-chain condition verification
    ///         before they submit partial decryptions.
    function checkReadCondition(
        address caller,
        bytes calldata conditionData,
        bytes calldata accessAuxData
    ) external view returns (bool) {
        return _check(caller, conditionData, accessAuxData);
    }

    /// @dev Core condition logic shared by both ABI-compatible entry points.
    ///      ownerOf() is wrapped in try/catch because OZ v5 reverts with
    ///      ERC721NonexistentToken for non-existent IDs — skip rather than revert.
    function _check(
        address caller,
        bytes calldata conditionData,
        bytes calldata accessAuxData
    ) internal view returns (bool) {
        (address licenseToken, address ipId, uint256 requiredTermsId) =
            abi.decode(conditionData, (address, address, uint256));

        uint256[] memory tokenIds = abi.decode(accessAuxData, (uint256[]));

        uint256 len = tokenIds.length;
        if (len == 0) return false;
        if (len > MAX_TOKEN_IDS) len = MAX_TOKEN_IDS;

        ILicenseToken lt = ILicenseToken(licenseToken);

        for (uint256 i = 0; i < len; ) {
            uint256 tokenId = tokenIds[i];

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
