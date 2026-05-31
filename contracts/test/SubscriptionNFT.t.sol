// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {SubscriptionNFT} from "../src/SubscriptionNFT.sol";

contract SubscriptionNFTTest is Test {
    SubscriptionNFT internal nft;

    address internal constant CREATOR = address(0xC0);
    address internal constant FAN_1   = address(0xF1);
    address internal constant FAN_2   = address(0xF2);

    uint256 internal constant PRICE = 0.01 ether;

    function setUp() public {
        nft = new SubscriptionNFT("Creator Pass", "PASS", PRICE, CREATOR);
        // Fund test accounts.
        vm.deal(FAN_1, 10 ether);
        vm.deal(FAN_2, 10 ether);
        vm.deal(CREATOR, 10 ether);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Deployment
    // ─────────────────────────────────────────────────────────────────────────

    function test_initial_state() public view {
        assertEq(nft.name(),        "Creator Pass");
        assertEq(nft.symbol(),      "PASS");
        assertEq(nft.mintPrice(),   PRICE);
        assertEq(nft.owner(),       CREATOR);
        assertEq(nft.totalSupply(), 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Subscribing
    // ─────────────────────────────────────────────────────────────────────────

    function test_subscribe_mints_token_to_recipient() public {
        vm.prank(FAN_1);
        nft.subscribe{value: PRICE}(FAN_1);

        assertEq(nft.balanceOf(FAN_1),  1);
        assertEq(nft.ownerOf(0),        FAN_1);
        assertEq(nft.totalSupply(),     1);
    }

    function test_subscribe_increments_token_ids() public {
        vm.prank(FAN_1);
        nft.subscribe{value: PRICE}(FAN_1);

        vm.prank(FAN_2);
        nft.subscribe{value: PRICE}(FAN_2);

        assertEq(nft.ownerOf(0), FAN_1);
        assertEq(nft.ownerOf(1), FAN_2);
        assertEq(nft.totalSupply(), 2);
    }

    function test_subscribe_accepts_overpayment() public {
        vm.prank(FAN_1);
        nft.subscribe{value: PRICE * 2}(FAN_1);   // double the price
        assertEq(nft.balanceOf(FAN_1), 1);
    }

    function test_subscribe_mints_to_different_recipient() public {
        vm.prank(FAN_1);
        nft.subscribe{value: PRICE}(FAN_2);        // FAN_1 pays, FAN_2 receives

        assertEq(nft.balanceOf(FAN_1), 0);
        assertEq(nft.balanceOf(FAN_2), 1);
    }

    function test_subscribe_reverts_insufficient_payment() public {
        vm.prank(FAN_1);
        vm.expectRevert(
            abi.encodeWithSelector(
                SubscriptionNFT.InsufficientPayment.selector,
                PRICE, PRICE - 1
            )
        );
        nft.subscribe{value: PRICE - 1}(FAN_1);
    }

    function test_subscribe_emits_event() public {
        vm.expectEmit(true, true, false, true);
        emit SubscriptionNFT.Subscribed(FAN_1, 0);

        vm.prank(FAN_1);
        nft.subscribe{value: PRICE}(FAN_1);
    }

    function test_subscribe_free_when_price_is_zero() public {
        SubscriptionNFT free = new SubscriptionNFT("Free Pass", "FREE", 0, CREATOR);
        free.subscribe{value: 0}(FAN_1);
        assertEq(free.balanceOf(FAN_1), 1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Price management (OZ v5 Ownable)
    // ─────────────────────────────────────────────────────────────────────────

    function test_creator_can_update_price() public {
        vm.prank(CREATOR);
        nft.setMintPrice(0.05 ether);
        assertEq(nft.mintPrice(), 0.05 ether);
    }

    function test_set_price_emits_event() public {
        vm.expectEmit(false, false, false, true);
        emit SubscriptionNFT.MintPriceUpdated(PRICE, 0.05 ether);

        vm.prank(CREATOR);
        nft.setMintPrice(0.05 ether);
    }

    function test_non_creator_cannot_set_price() public {
        vm.prank(FAN_1);
        // OZ v5 Ownable reverts with OwnableUnauthorizedAccount
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("OwnableUnauthorizedAccount(address)")),
                FAN_1
            )
        );
        nft.setMintPrice(0);
    }

    function test_new_price_enforced_on_next_mint() public {
        vm.prank(CREATOR);
        nft.setMintPrice(0.05 ether);

        vm.prank(FAN_1);
        vm.expectRevert(
            abi.encodeWithSelector(
                SubscriptionNFT.InsufficientPayment.selector,
                0.05 ether, PRICE  // PRICE < new 0.05 ether
            )
        );
        nft.subscribe{value: PRICE}(FAN_1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Withdrawal
    // ─────────────────────────────────────────────────────────────────────────

    function test_creator_withdraws_all_fees() public {
        vm.prank(FAN_1); nft.subscribe{value: PRICE}(FAN_1);
        vm.prank(FAN_2); nft.subscribe{value: PRICE}(FAN_2);

        uint256 before = CREATOR.balance;

        vm.prank(CREATOR);
        nft.withdraw();

        assertEq(CREATOR.balance, before + 2 * PRICE);
        assertEq(address(nft).balance, 0);
    }

    function test_non_creator_cannot_withdraw() public {
        vm.prank(FAN_1); nft.subscribe{value: PRICE}(FAN_1);

        vm.prank(FAN_1);
        vm.expectRevert(
            abi.encodeWithSelector(
                bytes4(keccak256("OwnableUnauthorizedAccount(address)")),
                FAN_1
            )
        );
        nft.withdraw();
    }

    function test_withdraw_with_zero_balance() public {
        uint256 before = CREATOR.balance;
        vm.prank(CREATOR);
        nft.withdraw();                  // should not revert
        assertEq(CREATOR.balance, before);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fuzz
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_subscribe_always_mints(uint256 overpay) public {
        vm.assume(overpay <= 5 ether);
        uint256 payment = PRICE + overpay;
        vm.deal(FAN_1, payment);

        vm.prank(FAN_1);
        nft.subscribe{value: payment}(FAN_1);
        assertEq(nft.balanceOf(FAN_1), 1);
    }

    function testFuzz_insufficient_payment_always_reverts(uint256 payment) public {
        vm.assume(payment < PRICE);
        vm.deal(FAN_1, payment);

        vm.prank(FAN_1);
        vm.expectRevert();
        nft.subscribe{value: payment}(FAN_1);
    }
}
