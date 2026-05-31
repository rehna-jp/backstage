// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TimeWindowedReadCondition} from "../src/TimeWindowedReadCondition.sol";
import {TieredLicenseReadCondition} from "../src/TieredLicenseReadCondition.sol";
import {SubscriptionNFT} from "../src/SubscriptionNFT.sol";

/// @dev Configurable stub — returns a fixed boolean from checkReadCondition.
///      Used to decouple TimeWindowedReadCondition tests from tier logic.
contract MockInnerCondition {
    bool private _result;

    constructor(bool result_) { _result = result_; }

    function checkReadCondition(address, bytes calldata, bytes calldata)
        external view returns (bool)
    {
        return _result;
    }
}

/// @dev Reentrant/reverting stub — always reverts on checkReadCondition.
contract RevertingInnerCondition {
    function checkReadCondition(address, bytes calldata, bytes calldata)
        external pure returns (bool)
    {
        revert("inner revert");
    }
}

contract TimeWindowedReadConditionTest is Test {
    TimeWindowedReadCondition internal condition;
    SubscriptionNFT internal subNft;
    MockInnerCondition internal innerTrue;
    MockInnerCondition internal innerFalse;

    address internal constant CREATOR     = address(0xC0);
    address internal constant SUBSCRIBER  = address(0x5B);
    address internal constant PUBLIC_USER = address(0xB0B);

    // Timestamps pinned relative to this base
    uint256 internal constant NOW      = 1_000_000;
    uint256 internal constant EARLY_AT = NOW + 100;
    uint256 internal constant RELEASE  = NOW + 200;

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _condData(
        address inner,
        bytes memory innerData,
        uint256 earlyAt,
        uint256 releaseAt,
        address nft
    ) internal pure returns (bytes memory) {
        return abi.encode(inner, innerData, earlyAt, releaseAt, nft);
    }

    function setUp() public {
        vm.warp(NOW);

        condition  = new TimeWindowedReadCondition();
        innerTrue  = new MockInnerCondition(true);
        innerFalse = new MockInnerCondition(false);

        subNft = new SubscriptionNFT("Test Pass", "PASS", 0, CREATOR);

        // Give SUBSCRIBER a pass.
        vm.prank(SUBSCRIBER);
        subNft.subscribe(SUBSCRIBER);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Pre-earlyAt: vault locked for everyone
    // ─────────────────────────────────────────────────────────────────────────

    function test_locked_before_early_at() public view {
        bytes memory cd = _condData(
            address(innerTrue), "", EARLY_AT, RELEASE, address(subNft)
        );
        // NOW < EARLY_AT — even a subscriber with a passing inner condition is blocked.
        assertFalse(condition.checkReadCondition(SUBSCRIBER, cd, "0x"));
        assertFalse(condition.checkReadCondition(PUBLIC_USER, cd, "0x"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Early-access window [earlyAt, releaseAt)
    // ─────────────────────────────────────────────────────────────────────────

    function test_subscriber_passes_in_early_window() public {
        vm.warp(EARLY_AT);
        bytes memory cd = _condData(
            address(innerTrue), "", EARLY_AT, RELEASE, address(subNft)
        );
        assertTrue(condition.checkReadCondition(SUBSCRIBER, cd, "0x"));
    }

    function test_non_subscriber_blocked_in_early_window() public {
        vm.warp(EARLY_AT);
        bytes memory cd = _condData(
            address(innerTrue), "", EARLY_AT, RELEASE, address(subNft)
        );
        assertFalse(condition.checkReadCondition(PUBLIC_USER, cd, "0x"));
    }

    function test_subscriber_blocked_when_inner_condition_fails() public {
        vm.warp(EARLY_AT);
        bytes memory cd = _condData(
            address(innerFalse), "", EARLY_AT, RELEASE, address(subNft)
        );
        assertFalse(condition.checkReadCondition(SUBSCRIBER, cd, "0x"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Public window [releaseAt, ∞)
    // ─────────────────────────────────────────────────────────────────────────

    function test_public_passes_after_release() public {
        vm.warp(RELEASE);
        bytes memory cd = _condData(
            address(innerTrue), "", EARLY_AT, RELEASE, address(subNft)
        );
        assertTrue(condition.checkReadCondition(PUBLIC_USER, cd, "0x"));
        assertTrue(condition.checkReadCondition(SUBSCRIBER,  cd, "0x"));
    }

    function test_public_blocked_when_inner_condition_fails() public {
        vm.warp(RELEASE);
        bytes memory cd = _condData(
            address(innerFalse), "", EARLY_AT, RELEASE, address(subNft)
        );
        assertFalse(condition.checkReadCondition(PUBLIC_USER, cd, "0x"));
    }

    function test_public_passes_long_after_release() public {
        vm.warp(RELEASE + 365 days);
        bytes memory cd = _condData(
            address(innerTrue), "", EARLY_AT, RELEASE, address(subNft)
        );
        assertTrue(condition.checkReadCondition(PUBLIC_USER, cd, "0x"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // earlyAt == 0: early access disabled
    // ─────────────────────────────────────────────────────────────────────────

    function test_no_early_access_when_early_at_is_zero() public {
        vm.warp(EARLY_AT); // between zero and RELEASE
        bytes memory cd = _condData(
            address(innerTrue), "", 0 /* earlyAt=0 */, RELEASE, address(subNft)
        );
        // Subscriber cannot access before releaseAt because earlyAt == 0.
        assertFalse(condition.checkReadCondition(SUBSCRIBER, cd, "0x"));
    }

    function test_public_still_works_after_release_when_early_at_is_zero() public {
        vm.warp(RELEASE);
        bytes memory cd = _condData(
            address(innerTrue), "", 0, RELEASE, address(subNft)
        );
        assertTrue(condition.checkReadCondition(PUBLIC_USER, cd, "0x"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // subscriptionNft == address(0): early access disabled
    // ─────────────────────────────────────────────────────────────────────────

    function test_no_early_access_when_nft_is_zero_address() public {
        vm.warp(EARLY_AT);
        bytes memory cd = _condData(
            address(innerTrue), "", EARLY_AT, RELEASE, address(0)
        );
        assertFalse(condition.checkReadCondition(SUBSCRIBER, cd, "0x"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // accessAuxData forwarded to inner condition
    // ─────────────────────────────────────────────────────────────────────────

    function test_forwarded_aux_data_reaches_inner_condition() public {
        // Use real TieredLicenseReadCondition + MockLicenseToken to verify
        // that accessAuxData is actually forwarded, not dropped.

        // Deploy a mock license token inline.
        MockLicenseTokenForIntegration lt = new MockLicenseTokenForIntegration();
        lt.setToken(7, SUBSCRIBER, address(0xAB), 42, false);

        TieredLicenseReadCondition tiered = new TieredLicenseReadCondition();

        bytes memory tieredCondData = abi.encode(
            address(lt), address(0xAB), uint256(42)
        );

        // accessAuxData must be abi.encode(uint256[]) — not a bare uint256.
        uint256[] memory ids = new uint256[](1);
        ids[0] = 7;
        bytes memory auxData = abi.encode(ids);

        vm.warp(RELEASE);
        bytes memory cd = _condData(
            address(tiered), tieredCondData, EARLY_AT, RELEASE, address(subNft)
        );

        // Should pass because SUBSCRIBER owns token 7 which satisfies tiered condition.
        assertTrue(condition.checkReadCondition(SUBSCRIBER, cd, auxData));

        // Should fail with an unregistered token ID.
        uint256[] memory wrongIds = new uint256[](1);
        wrongIds[0] = 99;
        assertFalse(condition.checkReadCondition(SUBSCRIBER, cd, abi.encode(wrongIds)));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Subscriber-only drop: no public release (releaseAt far in the future)
    // ─────────────────────────────────────────────────────────────────────────

    function test_subscriber_only_drop_scenario() public {
        uint256 distantFuture = NOW + 365 days;
        vm.warp(EARLY_AT);

        bytes memory cd = _condData(
            address(innerTrue), "", EARLY_AT, distantFuture, address(subNft)
        );

        assertTrue(condition.checkReadCondition(SUBSCRIBER,  cd, "0x"));
        assertFalse(condition.checkReadCondition(PUBLIC_USER, cd, "0x"));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fuzz
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_before_early_at_always_locked(uint256 ts) public {
        vm.assume(ts < EARLY_AT);
        vm.warp(ts);

        bytes memory cd = _condData(
            address(innerTrue), "", EARLY_AT, RELEASE, address(subNft)
        );
        assertFalse(condition.checkReadCondition(SUBSCRIBER,  cd, "0x"));
        assertFalse(condition.checkReadCondition(PUBLIC_USER, cd, "0x"));
    }

    function testFuzz_after_release_inner_result_propagates(bool innerResult, uint256 ts) public {
        vm.assume(ts >= RELEASE);
        vm.warp(ts);

        MockInnerCondition inner = new MockInnerCondition(innerResult);
        bytes memory cd = _condData(
            address(inner), "", EARLY_AT, RELEASE, address(subNft)
        );

        assertEq(
            condition.checkReadCondition(PUBLIC_USER, cd, "0x"),
            innerResult
        );
    }
}

/// @dev Helper mock used in the forwarded-aux-data integration test.
contract MockLicenseTokenForIntegration {
    struct T { address owner; address ip; uint256 terms; bool revoked; bool exists; }
    mapping(uint256 => T) private _t;

    function setToken(uint256 id, address o, address ip, uint256 terms, bool rev) external {
        _t[id] = T(o, ip, terms, rev, true);
    }
    function ownerOf(uint256 id) external view returns (address) {
        require(_t[id].exists, "nonexistent");
        return _t[id].owner;
    }
    function getLicensorIpId(uint256 id) external view returns (address) { return _t[id].ip; }
    function getLicenseTermsId(uint256 id) external view returns (uint256) { return _t[id].terms; }
    function isLicenseTokenRevoked(uint256 id) external view returns (bool) { return _t[id].revoked; }
}
