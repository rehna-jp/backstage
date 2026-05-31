// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {BackstageRegistry} from "../src/BackstageRegistry.sol";

contract BackstageRegistryTest is Test {
    BackstageRegistry internal registry;

    address internal constant CREATOR_A = address(0xA);
    address internal constant CREATOR_B = address(0xB);
    address internal constant STRANGER  = address(0x5);

    address internal constant IP_ID_1 = address(0x1111);
    address internal constant IP_ID_2 = address(0x2222);

    uint32[]  internal VAULTS;       // [fullTrack, stems]
    uint256[] internal TERMS;        // [stream, download, commercial]

    function setUp() public {
        registry = new BackstageRegistry();

        VAULTS = new uint32[](2);
        VAULTS[0] = 100;
        VAULTS[1] = 101;

        TERMS = new uint256[](3);
        TERMS[0] = 42;
        TERMS[1] = 43;
        TERMS[2] = 44;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // registerWork — happy path
    // ─────────────────────────────────────────────────────────────────────────

    function test_register_returns_incrementing_ids() public {
        vm.startPrank(CREATOR_A);
        uint256 id0 = registry.registerWork(IP_ID_1, "QmPreview1", VAULTS, TERMS, "ipfs://meta1");
        uint256 id1 = registry.registerWork(IP_ID_2, "QmPreview2", VAULTS, TERMS, "ipfs://meta2");
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(registry.totalWorks(), 2);
    }

    function test_register_stores_all_fields() public {
        vm.warp(12345);

        vm.prank(CREATOR_A);
        uint256 workId = registry.registerWork(
            IP_ID_1, "QmPreview", VAULTS, TERMS, "ipfs://metadata"
        );

        BackstageRegistry.Work memory w = registry.getWork(workId);
        assertEq(w.creator,            CREATOR_A);
        assertEq(w.ipId,               IP_ID_1);
        assertEq(w.previewCID,         "QmPreview");
        assertEq(w.gatedVaultUuids[0], 100);
        assertEq(w.gatedVaultUuids[1], 101);
        assertEq(w.licenseTermsIds[0], 42);
        assertEq(w.licenseTermsIds[1], 43);
        assertEq(w.licenseTermsIds[2], 44);
        assertEq(w.metadataURI,        "ipfs://metadata");
        assertEq(w.createdAt,          12345);
    }

    function test_register_emits_event() public {
        vm.expectEmit(true, true, true, true);
        emit BackstageRegistry.WorkRegistered(0, CREATOR_A, IP_ID_1, "ipfs://meta");

        vm.prank(CREATOR_A);
        registry.registerWork(IP_ID_1, "QmP", VAULTS, TERMS, "ipfs://meta");
    }

    function test_register_appends_to_creator_list() public {
        vm.startPrank(CREATOR_A);
        registry.registerWork(IP_ID_1, "", VAULTS, TERMS, "");
        registry.registerWork(IP_ID_2, "", VAULTS, TERMS, "");
        vm.stopPrank();

        vm.prank(CREATOR_B);
        registry.registerWork(IP_ID_1, "", VAULTS, TERMS, "");

        uint256[] memory aWorks = registry.listByCreator(CREATOR_A);
        uint256[] memory bWorks = registry.listByCreator(CREATOR_B);

        assertEq(aWorks.length, 2);
        assertEq(aWorks[0],     0);
        assertEq(aWorks[1],     1);
        assertEq(bWorks.length, 1);
        assertEq(bWorks[0],     2);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // registerWork — input validation
    // ─────────────────────────────────────────────────────────────────────────

    function test_register_reverts_zero_ip_id() public {
        vm.prank(CREATOR_A);
        vm.expectRevert(BackstageRegistry.ZeroIpId.selector);
        registry.registerWork(address(0), "", VAULTS, TERMS, "");
    }

    function test_register_reverts_empty_vaults() public {
        uint32[] memory empty;
        vm.prank(CREATOR_A);
        vm.expectRevert(BackstageRegistry.EmptyGatedVaults.selector);
        registry.registerWork(IP_ID_1, "", empty, TERMS, "");
    }

    function test_register_reverts_empty_terms() public {
        uint256[] memory empty;
        vm.prank(CREATOR_A);
        vm.expectRevert(BackstageRegistry.EmptyLicenseTermsIds.selector);
        registry.registerWork(IP_ID_1, "", VAULTS, empty, "");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // updateMetadata
    // ─────────────────────────────────────────────────────────────────────────

    function test_creator_can_update_metadata() public {
        vm.prank(CREATOR_A);
        uint256 workId = registry.registerWork(IP_ID_1, "", VAULTS, TERMS, "ipfs://old");

        vm.prank(CREATOR_A);
        registry.updateMetadata(workId, "ipfs://new");

        assertEq(registry.getWork(workId).metadataURI, "ipfs://new");
    }

    function test_update_emits_event() public {
        vm.prank(CREATOR_A);
        uint256 workId = registry.registerWork(IP_ID_1, "", VAULTS, TERMS, "ipfs://old");

        vm.expectEmit(true, false, false, true);
        emit BackstageRegistry.MetadataUpdated(workId, "ipfs://new");

        vm.prank(CREATOR_A);
        registry.updateMetadata(workId, "ipfs://new");
    }

    function test_non_creator_cannot_update_metadata() public {
        vm.prank(CREATOR_A);
        uint256 workId = registry.registerWork(IP_ID_1, "", VAULTS, TERMS, "ipfs://old");

        vm.prank(STRANGER);
        vm.expectRevert(
            abi.encodeWithSelector(BackstageRegistry.NotCreator.selector, workId, STRANGER)
        );
        registry.updateMetadata(workId, "ipfs://evil");
    }

    function test_other_creator_cannot_update_metadata() public {
        vm.prank(CREATOR_A);
        uint256 workId = registry.registerWork(IP_ID_1, "", VAULTS, TERMS, "");

        vm.prank(CREATOR_B);
        vm.expectRevert(
            abi.encodeWithSelector(BackstageRegistry.NotCreator.selector, workId, CREATOR_B)
        );
        registry.updateMetadata(workId, "ipfs://evil");
    }

    function test_update_nonexistent_work_reverts() public {
        vm.prank(CREATOR_A);
        vm.expectRevert(
            abi.encodeWithSelector(BackstageRegistry.WorkNotFound.selector, 999)
        );
        registry.updateMetadata(999, "ipfs://x");
    }

    // ─────────────────────────────────────────────────────────────────────────
    // getWork
    // ─────────────────────────────────────────────────────────────────────────

    function test_get_nonexistent_work_reverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(BackstageRegistry.WorkNotFound.selector, 0)
        );
        registry.getWork(0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // listByCreator
    // ─────────────────────────────────────────────────────────────────────────

    function test_list_returns_empty_for_unknown_creator() public view {
        uint256[] memory works = registry.listByCreator(address(0xDEAD));
        assertEq(works.length, 0);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fuzz
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_register_and_retrieve(address ipId) public {
        vm.assume(ipId != address(0));

        vm.prank(CREATOR_A);
        uint256 workId = registry.registerWork(ipId, "QmFuzz", VAULTS, TERMS, "ipfs://fuzz");

        BackstageRegistry.Work memory w = registry.getWork(workId);
        assertEq(w.ipId, ipId);
        assertEq(w.creator, CREATOR_A);
    }

    function testFuzz_only_creator_can_update(address attacker) public {
        vm.assume(attacker != CREATOR_A);

        vm.prank(CREATOR_A);
        uint256 workId = registry.registerWork(IP_ID_1, "", VAULTS, TERMS, "");

        vm.prank(attacker);
        vm.expectRevert();
        registry.updateMetadata(workId, "ipfs://attack");
    }
}
