
import React, { useState } from 'react';
import { useMembers } from '../../../contexts/MembersContext';
import { User } from '../../../types';
import AdminClientDetailView from '../admin/AdminClientDetailView';
import ClientManagementTab from '../admin/ClientManagementTab';
import { useModalRegistry } from '../../../contexts/ModalRegistryContext';

// HR-Hub-side wrapper for the admin Client Register. Reuses the admin list and
// detail views so HR Managers get full parity with admins (reputation-adjust,
// admin notes).
//
// State is liftable to HRHubView via optional props so clicking the
// "Client Register" nav while drilled into a client returns to the list.
interface HRClientRegisterTabProps {
    managingClientId?: number | null;
    setManagingClientId?: (id: number | null) => void;
}

const HRClientRegisterTab: React.FC<HRClientRegisterTabProps> = ({
    managingClientId: extId,
    setManagingClientId: extSet,
}) => {
    const [internalId, setInternalId] = useState<number | null>(null);
    const managingClientId = extId !== undefined ? extId : internalId;
    const setManagingClientId = extSet || setInternalId;

    const { allUsers } = useMembers();
    const { openAdjustReputationModal, openReputationHistoryModal } = useModalRegistry();

    const setManagingClient = (user: User | null) => setManagingClientId(user?.id ?? null);
    const managingClient = managingClientId ? allUsers.find(u => u.id === managingClientId) || null : null;

    if (managingClient) {
        return (
            <div className="animate-fade-in -m-4 sm:-m-6">
                <AdminClientDetailView
                    user={managingClient}
                    onBack={() => setManagingClientId(null)}
                    openAdjustReputationModal={openAdjustReputationModal}
                    openReputationHistoryModal={openReputationHistoryModal}
                />
            </div>
        );
    }

    return (
        <div className="animate-fade-in -m-4 sm:-m-6">
            <ClientManagementTab onManageUser={setManagingClient} />
        </div>
    );
};

export default HRClientRegisterTab;
