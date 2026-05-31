// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title  SubscriptionNFT
/// @notice Minimal ERC-721 subscriber pass for a creator's channel.
///         Creators deploy one instance per channel. Fans call `subscribe()`
///         with the mint fee to receive a soulbound-style pass that satisfies
///         `TimeWindowedReadCondition`'s early-access check.
///
///         OZ v5 patterns used:
///           - Ownable(creator): explicit initial owner, not msg.sender shortcut
///           - Custom errors: InsufficientPayment, WithdrawFailed
///           - _safeMint(to, tokenId): unchanged v5 API
///           - No _exists(): _ownerOf(tokenId) != address(0) where needed
contract SubscriptionNFT is ERC721, Ownable {
    error InsufficientPayment(uint256 required, uint256 provided);
    error WithdrawFailed();

    /// @notice Current price in wei to mint one subscription token.
    uint256 public mintPrice;

    uint256 private _nextTokenId;

    event Subscribed(address indexed subscriber, uint256 indexed tokenId);
    event MintPriceUpdated(uint256 oldPrice, uint256 newPrice);

    /// @param name_       ERC-721 collection name (e.g. "Artist Name Pass")
    /// @param symbol_     ERC-721 symbol (e.g. "PASS")
    /// @param mintPrice_  Initial mint price in wei
    /// @param creator     Address that owns this contract and receives proceeds
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 mintPrice_,
        address creator
    ) ERC721(name_, symbol_) Ownable(creator) {
        mintPrice = mintPrice_;
    }

    /// @notice Mint a subscription token to `to`. Caller must send at least `mintPrice` wei.
    ///         Excess payment is accepted (treated as a tip).
    function subscribe(address to) external payable {
        if (msg.value < mintPrice) {
            revert InsufficientPayment(mintPrice, msg.value);
        }
        uint256 tokenId = _nextTokenId;
        unchecked { _nextTokenId++; }
        _safeMint(to, tokenId);
        emit Subscribed(to, tokenId);
    }

    /// @notice Update the subscription price. Only callable by the creator.
    function setMintPrice(uint256 newPrice) external onlyOwner {
        emit MintPriceUpdated(mintPrice, newPrice);
        mintPrice = newPrice;
    }

    /// @notice Withdraw all accumulated subscription fees to the creator wallet.
    function withdraw() external onlyOwner {
        (bool ok,) = payable(owner()).call{value: address(this).balance}("");
        if (!ok) revert WithdrawFailed();
    }

    /// @notice Total number of subscription tokens minted.
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }
}
