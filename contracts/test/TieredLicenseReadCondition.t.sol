// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test} from "forge-std/Test.sol";
import {TieredLicenseReadCondition} from "../src/TieredLicenseReadCondition.sol";

/// @dev In-test mock for the Story LicenseToken contract.
///      Lets us configure per-token ownership, IP ID, terms ID, and revocation
///      without deploying the full Story stack.
contract MockLicenseToken {
    struct TokenData {
        address owner;
        address licensorIpId;
        uint256 licenseTermsId;
        bool revoked;
        bool exists;
    }

    mapping(uint256 => TokenData) private _tokens;

    function setToken(
        uint256 tokenId,
        address owner_,
        address licensorIpId_,
        uint256 licenseTermsId_,
        bool revoked_
    ) external {
        _tokens[tokenId] = TokenData({
            owner: owner_,
            licensorIpId: licensorIpId_,
            licenseTermsId: licenseTermsId_,
            revoked: revoked_,
            exists: true
        });
    }

    // Mirrors OZ v5 ERC721: reverts for non-existent tokens.
    function ownerOf(uint256 tokenId) external view returns (address) {
        TokenData storage t = _tokens[tokenId];
        require(t.exists, "ERC721NonexistentToken");
        return t.owner;
    }

    function getLicensorIpId(uint256 tokenId) external view returns (address) {
        return _tokens[tokenId].licensorIpId;
    }

    function getLicenseTermsId(uint256 tokenId) external view returns (uint256) {
        return _tokens[tokenId].licenseTermsId;
    }

    function isLicenseTokenRevoked(uint256 tokenId) external view returns (bool) {
        return _tokens[tokenId].revoked;
    }
}

contract TieredLicenseReadConditionTest is Test {
    TieredLicenseReadCondition internal condition;
    MockLicenseToken internal lt;

    address internal constant BUYER    = address(0xB0B);
    address internal constant STRANGER = address(0xBAD);
    address internal constant IP_ID    = address(0x1111);

    uint256 internal constant STREAM_TERMS_ID     = 42;
    uint256 internal constant DOWNLOAD_TERMS_ID   = 43;
    uint256 internal constant COMMERCIAL_TERMS_ID = 44;

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _condData(address licenseToken, address ipId, uint256 termsId)
        internal pure returns (bytes memory)
    {
        return abi.encode(licenseToken, ipId, termsId);
    }

    function _auxData(uint256[] memory ids) internal pure returns (bytes memory) {
        return abi.encode(ids);
    }

    function _one(uint256 id) internal pure returns (uint256[] memory) {
        uint256[] memory a = new uint256[](1);
        a[0] = id;
        return a;
    }

    function _two(uint256 a_, uint256 b_) internal pure returns (uint256[] memory) {
        uint256[] memory a = new uint256[](2);
        a[0] = a_; a[1] = b_;
        return a;
    }

    // ── Setup ─────────────────────────────────────────────────────────────────

    function setUp() public {
        condition = new TieredLicenseReadCondition();
        lt = new MockLicenseToken();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Happy path
    // ─────────────────────────────────────────────────────────────────────────

    function test_passes_correct_owner_ip_terms() public view {
        // Token 1: owned by BUYER, for IP_ID, stream tier, not revoked.
        // NOTE: We can't call setToken here (view), so use a fresh setUp-equivalent
        // in a wrapper below.
    }

    // forge test doesn't support setUp in view functions; use non-view tests.

    function test_passes_when_all_conditions_met() public {
        lt.setToken(1, BUYER, IP_ID, STREAM_TERMS_ID, false);

        assertTrue(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_one(1))
            )
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Single-condition failures
    // ─────────────────────────────────────────────────────────────────────────

    function test_rejects_wrong_caller() public {
        lt.setToken(1, BUYER, IP_ID, STREAM_TERMS_ID, false);

        assertFalse(
            condition.checkReadCondition(
                STRANGER, // caller != token owner
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_one(1))
            )
        );
    }

    function test_rejects_wrong_ip_id() public {
        address wrongIp = address(0x2222);
        lt.setToken(1, BUYER, wrongIp, STREAM_TERMS_ID, false);

        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_one(1))
            )
        );
    }

    function test_rejects_wrong_terms_id() public {
        lt.setToken(1, BUYER, IP_ID, DOWNLOAD_TERMS_ID, false); // wrong tier

        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_one(1))
            )
        );
    }

    function test_rejects_revoked_token() public {
        lt.setToken(1, BUYER, IP_ID, STREAM_TERMS_ID, true); // revoked

        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_one(1))
            )
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Edge cases: non-existent tokens and empty array
    // ─────────────────────────────────────────────────────────────────────────

    function test_skips_nonexistent_token_without_reverting() public view {
        // Token 999 was never set; ownerOf will revert → should be skipped, not propagated.
        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_one(999))
            )
        );
    }

    function test_nonexistent_first_valid_second() public {
        lt.setToken(2, BUYER, IP_ID, STREAM_TERMS_ID, false);

        assertTrue(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_two(999, 2)) // 999 skipped, 2 passes
            )
        );
    }

    function test_rejects_empty_token_array() public view {
        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                abi.encode(new uint256[](0))
            )
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Array iteration
    // ─────────────────────────────────────────────────────────────────────────

    function test_finds_valid_token_in_second_position() public {
        lt.setToken(1, STRANGER, IP_ID, STREAM_TERMS_ID, false); // wrong owner
        lt.setToken(2, BUYER,   IP_ID, STREAM_TERMS_ID, false); // correct

        assertTrue(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_two(1, 2))
            )
        );
    }

    function test_cap_at_10_tokens_excludes_eleventh() public {
        // Tokens at indices 0-9 (IDs 0-9): wrong owner.
        // Token at index 10 (ID 10): correct owner — must NOT be checked.
        for (uint256 i = 0; i < 10; i++) {
            lt.setToken(i, STRANGER, IP_ID, STREAM_TERMS_ID, false);
        }
        lt.setToken(10, BUYER, IP_ID, STREAM_TERMS_ID, false);

        uint256[] memory ids = new uint256[](11);
        for (uint256 i = 0; i < 11; i++) { ids[i] = i; }

        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(ids)
            )
        );
    }

    function test_cap_valid_token_within_first_10_passes() public {
        // Token at index 9 (last allowed): correct.
        for (uint256 i = 0; i < 9; i++) {
            lt.setToken(i, STRANGER, IP_ID, STREAM_TERMS_ID, false);
        }
        lt.setToken(9, BUYER, IP_ID, STREAM_TERMS_ID, false);

        uint256[] memory ids = new uint256[](11);
        for (uint256 i = 0; i < 11; i++) { ids[i] = i; }

        assertTrue(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(ids)
            )
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Tier isolation — the core value proposition for the hackathon
    // ─────────────────────────────────────────────────────────────────────────

    function test_tier_isolation_stream_cannot_unlock_download() public {
        lt.setToken(1, BUYER, IP_ID, STREAM_TERMS_ID, false);

        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, DOWNLOAD_TERMS_ID), // download vault
                _auxData(_one(1))
            )
        );
    }

    function test_tier_isolation_stream_cannot_unlock_commercial() public {
        lt.setToken(1, BUYER, IP_ID, STREAM_TERMS_ID, false);

        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, COMMERCIAL_TERMS_ID), // commercial vault
                _auxData(_one(1))
            )
        );
    }

    function test_tier_isolation_full_three_tier_scenario() public {
        // Buyer holds only a stream token.
        lt.setToken(100, BUYER, IP_ID, STREAM_TERMS_ID, false);

        bytes memory auxData = _auxData(_one(100));

        // Stream vault: allowed.
        assertTrue(condition.checkReadCondition(
            BUYER, _condData(address(lt), IP_ID, STREAM_TERMS_ID), auxData
        ));

        // Download vault: blocked.
        assertFalse(condition.checkReadCondition(
            BUYER, _condData(address(lt), IP_ID, DOWNLOAD_TERMS_ID), auxData
        ));

        // Commercial vault: blocked.
        assertFalse(condition.checkReadCondition(
            BUYER, _condData(address(lt), IP_ID, COMMERCIAL_TERMS_ID), auxData
        ));
    }

    function test_commercial_tier_unlocks_only_commercial_vault() public {
        lt.setToken(200, BUYER, IP_ID, COMMERCIAL_TERMS_ID, false);

        bytes memory auxData = _auxData(_one(200));

        assertFalse(condition.checkReadCondition(
            BUYER, _condData(address(lt), IP_ID, STREAM_TERMS_ID), auxData
        ));
        assertFalse(condition.checkReadCondition(
            BUYER, _condData(address(lt), IP_ID, DOWNLOAD_TERMS_ID), auxData
        ));
        assertTrue(condition.checkReadCondition(
            BUYER, _condData(address(lt), IP_ID, COMMERCIAL_TERMS_ID), auxData
        ));
    }

    function test_different_ip_same_terms_is_blocked() public {
        address otherIp = address(0x9999);
        lt.setToken(1, BUYER, otherIp, STREAM_TERMS_ID, false); // token for a DIFFERENT IP

        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID), // vault for IP_ID
                _auxData(_one(1))
            )
        );
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Fuzz tests
    // ─────────────────────────────────────────────────────────────────────────

    function testFuzz_rejects_any_wrong_caller(address wrongCaller) public {
        vm.assume(wrongCaller != BUYER);
        lt.setToken(1, BUYER, IP_ID, STREAM_TERMS_ID, false);

        assertFalse(
            condition.checkReadCondition(
                wrongCaller,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_one(1))
            )
        );
    }

    function testFuzz_rejects_any_wrong_ip(address wrongIp) public {
        vm.assume(wrongIp != IP_ID);
        lt.setToken(1, BUYER, wrongIp, STREAM_TERMS_ID, false);

        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_one(1))
            )
        );
    }

    function testFuzz_rejects_any_wrong_terms_id(uint256 wrongTermsId) public {
        vm.assume(wrongTermsId != STREAM_TERMS_ID);
        lt.setToken(1, BUYER, IP_ID, wrongTermsId, false);

        assertFalse(
            condition.checkReadCondition(
                BUYER,
                _condData(address(lt), IP_ID, STREAM_TERMS_ID),
                _auxData(_one(1))
            )
        );
    }

    function testFuzz_correct_token_always_passes(
        address buyer_,
        address ipId_,
        uint256 termsId_,
        uint256 tokenId_
    ) public {
        vm.assume(buyer_ != address(0));
        vm.assume(ipId_ != address(0));

        lt.setToken(tokenId_, buyer_, ipId_, termsId_, false);

        assertTrue(
            condition.checkReadCondition(
                buyer_,
                _condData(address(lt), ipId_, termsId_),
                _auxData(_one(tokenId_))
            )
        );
    }
}
