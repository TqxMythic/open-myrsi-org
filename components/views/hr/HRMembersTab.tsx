
import React, { useState } from 'react';

import { useMembers } from '../../../contexts/MembersContext';
import { User, UserRole } from '../../../types';
import AdminUserDetailView from '../admin/AdminUserDetailView';
import AdminClientDetailView from '../admin/AdminClientDetailView';
import AdminMemberManagement from '../admin/AdminMemberManagement';
import { useModalRegistry } from '../../../contexts/ModalRegistryContext';

interface HRMembersTabProps {
    // Lifted to HRHubView so the "Manage Members" nav item can clear the
    // detail-view state and return the user to the roster.
    managingUserId?: number | null;
    setManagingUserId?: (id: number | null) => void;
}

const HRMembersTab: React.FC<HRMembersTabProps> = ({ managingUserId: extId, setManagingUserId: extSet }) => {
    const [internalId, setInternalId] = useState<number | null>(null);
    const managingUserId = extId !== undefined ? extId : internalId;
    const setManagingUserId = extSet || setInternalId;
    const { allUsers } = useMembers();
    const { openAdjustReputationModal, openReputationHistoryModal, openRatingHistoryModal, openAwardSingleCertModal, openAwardSingleCommendModal, openAddConductEntryModal } = useModalRegistry();

    const setManagingUser = (user: User | null) => setManagingUserId(user?.id ?? null);
    const managingUser = managingUserId ? allUsers.find(u => u.id === managingUserId) || null : null;

    if (managingUser) {
        if (managingUser.role === UserRole.Client) {
            return (
                <div className="animate-fade-in -m-4 sm:-m-6">
                    <AdminClientDetailView
                        user={managingUser}
                        onBack={() => setManagingUserId(null)}
                        openAdjustReputationModal={openAdjustReputationModal}
                        openReputationHistoryModal={openReputationHistoryModal}
                    />
                </div>
            );
        }
        return (
            <div className="animate-fade-in -m-4 sm:-m-6">
                <AdminUserDetailView
                    user={managingUser}
                    onBack={() => setManagingUserId(null)}
                    openReputationHistoryModal={openReputationHistoryModal}
                    openRatingHistoryModal={openRatingHistoryModal}
                    openAdjustReputationModal={openAdjustReputationModal}
                    openAwardSingleCertModal={openAwardSingleCertModal}
                    openAwardSingleCommendModal={openAwardSingleCommendModal}
                    openAddConductEntryModal={openAddConductEntryModal}
                />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in -m-4 sm:-m-6">
            <AdminMemberManagement onManageUser={setManagingUser} scrollId="hr-roster-list" />
        </div>
    );
};

export default HRMembersTab;
