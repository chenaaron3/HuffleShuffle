import { Mic, Video } from 'lucide-react';
import * as React from 'react';

interface MediaPermissionsModalProps {
    isPlayer: boolean;
}

/**
 * Modal component that requests camera and microphone permissions for players
 * Only shows for players (not dealers)
 * Allows page to continue loading even if permissions are denied
 *
 * This modal requests permissions when the table page loads, before LiveKit connects.
 * If permissions are denied, the page will still load and LiveKit will handle
 * the connection without media tracks.
 */
export function MediaPermissionsModal({ isPlayer }: MediaPermissionsModalProps) {
    const [showModal, setShowModal] = React.useState(false);
    const [isRequesting, setIsRequesting] = React.useState(false);
    const requestedRef = React.useRef(false);
    const checkingRef = React.useRef(false);

    // Check if permissions are already granted
    const checkExistingPermissions = React.useCallback(async () => {
        if (!navigator.permissions) {
            // Permissions API not available, show modal anyway
            return false;
        }

        try {
            const [cameraStatus, microphoneStatus] = await Promise.all([
                navigator.permissions
                    .query({ name: "camera" as PermissionName })
                    .catch(() => null),
                navigator.permissions
                    .query({ name: "microphone" as PermissionName })
                    .catch(() => null),
            ]);

            // If both are granted, no need to show modal
            if (
                cameraStatus?.state === "granted" &&
                microphoneStatus?.state === "granted"
            ) {
                return true;
            }
        } catch (error) {
            // Permissions API might not support camera/microphone queries in all browsers
            console.log("Could not check permission status:", error);
        }

        return false;
    }, []);

    React.useEffect(() => {
        // Only request permissions for players
        if (!isPlayer || requestedRef.current || checkingRef.current) return;

        // Check if browser supports mediaDevices API
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.log("MediaDevices API not available");
            requestedRef.current = true;
            return;
        }

        // Check if permissions are already granted
        checkingRef.current = true;
        checkExistingPermissions()
            .then((alreadyGranted) => {
                if (alreadyGranted) {
                    requestedRef.current = true;
                    checkingRef.current = false;
                    return;
                }
                // Show modal to request permissions
                setShowModal(true);
                checkingRef.current = false;
            })
            .catch(() => {
                // If check fails, show modal anyway
                setShowModal(true);
                checkingRef.current = false;
            });
    }, [isPlayer, checkExistingPermissions]);

    const requestPermissions = React.useCallback(async () => {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("MediaDevices API not available");
            requestedRef.current = true;
            setShowModal(false);
            setIsRequesting(false);
            return;
        }

        setIsRequesting(true);

        try {
            console.log("Requesting camera and microphone permissions...");

            // Request both camera and microphone permissions
            // This will trigger the browser's permission prompt
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true,
            });

            console.log("Permissions granted successfully");

            // Stop the stream immediately - we just needed permission
            // LiveKit will request its own stream when connecting
            stream.getTracks().forEach((track) => {
                track.stop();
            });

            requestedRef.current = true;
            setIsRequesting(false);
            setShowModal(false);
        } catch (error) {
            // User denied permissions or error occurred - that's okay, continue anyway
            // LiveKit will handle the connection gracefully without media tracks
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            console.log("Media permissions request failed or denied:", errorMessage);

            requestedRef.current = true;
            setIsRequesting(false);

            // Close modal after a short delay to show the error was handled
            setTimeout(() => {
                setShowModal(false);
            }, 500);
        }
    }, []);

    const handleAllow = React.useCallback(() => {
        if (isRequesting) return;
        console.log("Allow button clicked, requesting permissions...");
        void requestPermissions();
    }, [requestPermissions, isRequesting]);

    const handleSkip = React.useCallback(() => {
        console.log("Skip button clicked, continuing without permissions");
        requestedRef.current = true;
        setShowModal(false);
    }, []);

    if (!showModal) return null;

    // When requesting, hide the modal content but keep it mounted so state persists
    // The browser's permission prompt will appear on top
    if (isRequesting) {
        return (
            <div className="fixed inset-0 z-40 bg-black/60 flex items-center justify-center p-4">
                <div className="text-center text-white">
                    <p className="text-lg font-medium mb-2">Waiting for permission...</p>
                    <p className="text-sm text-zinc-400">
                        Please check your browser's address bar or notification area for the permission request.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="flex w-full max-w-md flex-col overflow-hidden rounded-lg bg-zinc-900 text-white shadow-xl border border-white/10">
                <div className="px-6 py-5">
                    <h3 className="text-xl font-semibold mb-2">Camera & Microphone Access</h3>
                    <p className="text-sm text-zinc-400 mb-6">
                        To participate in the game with video and audio, we need access to your camera and microphone.
                    </p>

                    <div className="space-y-3 mb-6">
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-full bg-blue-500/20 p-2">
                                <Video className="h-4 w-4 text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Camera</p>
                                <p className="text-xs text-zinc-400">Share your video feed with other players</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3">
                            <div className="mt-0.5 rounded-full bg-green-500/20 p-2">
                                <Mic className="h-4 w-4 text-green-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium text-white">Microphone</p>
                                <p className="text-xs text-zinc-400">Enable voice communication during the game</p>
                            </div>
                        </div>
                    </div>

                    <p className="text-xs text-zinc-500 mb-6">
                        You can still join the game without these permissions, but video and audio features will be unavailable.
                    </p>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-white/10 bg-zinc-900/95 px-6 py-4">
                    <button
                        type="button"
                        onClick={handleSkip}
                        disabled={isRequesting}
                        className="rounded-md border border-white/10 px-4 py-2 text-sm text-zinc-200 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Skip
                    </button>
                    <button
                        type="button"
                        onClick={handleAllow}
                        disabled={isRequesting}
                        className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Allow
                    </button>
                </div>
            </div>
        </div>
    );
}

