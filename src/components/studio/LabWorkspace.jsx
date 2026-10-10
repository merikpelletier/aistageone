import React from 'react';
import ComposeSceneBuilder from '@/components/studio/ComposeSceneBuilder';
import LegacyLabWorkspace from '@/components/studio/LegacyLabWorkspace';

export default function LabWorkspace(props) {
  if (props.directTool === 'compose') {
    return (
      <div className="aistage-tool-surface bg-black p-4 sm:p-6 lg:p-8">
        <ComposeSceneBuilder
          userEmail={props.user?.email}
          onDone={() => {}}
        />
      </div>
    );
  }

  return <LegacyLabWorkspace {...props} />;
}
