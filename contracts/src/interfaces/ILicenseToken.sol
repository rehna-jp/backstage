// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @notice Minimal interface for Story Protocol's LicenseToken contract.
///         Covers only the functions needed by Backstage condition contracts.
///         Full interface: storyprotocol/protocol-core-v1 contracts/interfaces/ILicenseToken.sol
///
///         Deployed on Aeneid: 0xFe3838BFb30B34170F00030B52eA4893d8aAC6bC
interface ILicenseToken {
    /// @notice Returns the owner of the given license token (ERC-721 standard).
    ///         Reverts with ERC721NonexistentToken if the token does not exist.
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Returns the IP Asset for which this license token was minted.
    function getLicensorIpId(uint256 tokenId) external view returns (address);

    /// @notice Returns the License Terms ID encoded in this license token.
    function getLicenseTermsId(uint256 tokenId) external view returns (uint256);

    /// @notice Returns true if this license token has been revoked by the licensor.
    function isLicenseTokenRevoked(uint256 tokenId) external view returns (bool);
}
