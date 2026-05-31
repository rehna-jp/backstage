// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title  BackstageRegistry
/// @notice On-chain catalog that links Story IP Assets to their CDR vaults and
///         metadata. Acts as the source of truth for the Backstage frontend:
///         discovery page, work detail page, and creator dashboard all read here.
///
///         Design decisions:
///           - `previewCID`      plain IPFS CID; preview audio is always free (no CDR)
///           - `gatedVaultUuids` CDR vault UUIDs (uint32); one per encrypted content layer
///                               Convention: [0] = full track, [1] = stems
///           - `licenseTermsIds` all PIL terms IDs attached to the IP Asset
///                               Convention: [0] = stream, [1] = download, [2] = commercial
///             These two arrays are independent. The vault's own CDR conditionData
///             encodes the specific requiredTermsId; the registry just surfaces them
///             for the frontend's pricing UI.
///           - No OZ Ownable: access control is per-work (only `creator` can update)
///           - `address(0)` creator field is the sentinel for "work not found"
contract BackstageRegistry {
    // ── Errors ────────────────────────────────────────────────────────────────

    error WorkNotFound(uint256 workId);
    error NotCreator(uint256 workId, address caller);
    error EmptyGatedVaults();
    error EmptyLicenseTermsIds();
    error ZeroIpId();

    // ── Types ─────────────────────────────────────────────────────────────────

    /// @notice A registered creative work.
    struct Work {
        /// Address that registered this work; has exclusive update rights.
        address creator;
        /// Story Protocol IP Asset address for this work.
        address ipId;
        /// IPFS CID of the unencrypted preview clip (always publicly accessible).
        string previewCID;
        /// CDR vault UUIDs for gated content layers.
        /// Index 0 = full track vault, index 1 = stems vault (by convention).
        uint32[] gatedVaultUuids;
        /// PIL License Terms IDs attached to the IP Asset.
        /// Index 0 = stream, 1 = download, 2 = commercial (by convention).
        uint256[] licenseTermsIds;
        /// IPFS URI pointing to the JSON metadata (cover art, title, description).
        string metadataURI;
        /// Block timestamp at registration.
        uint256 createdAt;
    }

    // ── State ─────────────────────────────────────────────────────────────────

    uint256 private _nextWorkId;
    mapping(uint256 => Work) private _works;
    mapping(address => uint256[]) private _creatorWorks;

    // ── Events ────────────────────────────────────────────────────────────────

    event WorkRegistered(
        uint256 indexed workId,
        address indexed creator,
        address indexed ipId,
        string metadataURI
    );

    event MetadataUpdated(uint256 indexed workId, string metadataURI);

    // ── Write ─────────────────────────────────────────────────────────────────

    /// @notice Register a new work. Caller becomes the work's creator.
    /// @param ipId            Story IP Asset address
    /// @param previewCID      IPFS CID of the free preview clip
    /// @param gatedVaultUuids CDR vault UUIDs ([fullTrack, stems])
    /// @param licenseTermsIds PIL terms IDs ([stream, download, commercial])
    /// @param metadataURI     IPFS URI for cover art and description JSON
    /// @return workId         Auto-incremented identifier for this work
    function registerWork(
        address ipId,
        string calldata previewCID,
        uint32[] calldata gatedVaultUuids,
        uint256[] calldata licenseTermsIds,
        string calldata metadataURI
    ) external returns (uint256 workId) {
        if (ipId == address(0)) revert ZeroIpId();
        if (gatedVaultUuids.length == 0) revert EmptyGatedVaults();
        if (licenseTermsIds.length == 0) revert EmptyLicenseTermsIds();

        workId = _nextWorkId;
        unchecked { _nextWorkId++; }

        _works[workId] = Work({
            creator:          msg.sender,
            ipId:             ipId,
            previewCID:       previewCID,
            gatedVaultUuids:  gatedVaultUuids,
            licenseTermsIds:  licenseTermsIds,
            metadataURI:      metadataURI,
            createdAt:        block.timestamp
        });

        _creatorWorks[msg.sender].push(workId);

        emit WorkRegistered(workId, msg.sender, ipId, metadataURI);
    }

    /// @notice Update the metadata URI of an existing work.
    ///         Only the original creator may call this.
    function updateMetadata(uint256 workId, string calldata metadataURI) external {
        Work storage work = _works[workId];
        if (work.creator == address(0)) revert WorkNotFound(workId);
        if (work.creator != msg.sender) revert NotCreator(workId, msg.sender);

        work.metadataURI = metadataURI;
        emit MetadataUpdated(workId, metadataURI);
    }

    // ── Read ──────────────────────────────────────────────────────────────────

    /// @notice Fetch a work by ID. Reverts if it does not exist.
    function getWork(uint256 workId) external view returns (Work memory) {
        Work memory work = _works[workId];
        if (work.creator == address(0)) revert WorkNotFound(workId);
        return work;
    }

    /// @notice Return all work IDs registered by `creator`, in registration order.
    function listByCreator(address creator) external view returns (uint256[] memory) {
        return _creatorWorks[creator];
    }

    /// @notice Total number of works ever registered (including work 0).
    function totalWorks() external view returns (uint256) {
        return _nextWorkId;
    }
}
