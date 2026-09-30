import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:livekit_client/livekit_client.dart';
import 'package:permission_handler/permission_handler.dart';

class AdminLiveScreen extends StatefulWidget {
  final dynamic apiService;

  const AdminLiveScreen({super.key, this.apiService});

  @override
  State<AdminLiveScreen> createState() => _AdminLiveScreenState();
}

class _AdminLiveScreenState extends State<AdminLiveScreen> {
  Room? _room;
  bool _isLive = false;
  bool _isLoading = false;
  String _statusMessage = 'Stream is offline';

  Future<void> _toggleLiveStream() async {
    if (_isLive) {
      await _room?.disconnect();
      setState(() {
        _isLive = false;
        _room = null;
        _statusMessage = 'Stream is offline';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _statusMessage = 'Requesting permissions...';
    });

    try {
      // 1. Request Camera and Microphone permissions explicitly
      Map<Permission, PermissionStatus> statuses = await [
        Permission.camera,
        Permission.microphone,
      ].request();

      if (statuses[Permission.camera] != PermissionStatus.granted ||
          statuses[Permission.microphone] != PermissionStatus.granted) {
        throw Exception('Camera and Microphone permissions are required to broadcast.');
      }

      setState(() {
        _statusMessage = 'Fetching broadcast token...';
      });

      // 2. Fetch token from Render backend
      final url = Uri.parse('https://child-care-foundation-api.onrender.com/api/live/token?room=ccf-official-live');
      final response = await http.get(url);

      if (response.statusCode != 200) {
        throw Exception('Backend HTTP ${response.statusCode}: ${response.body}');
      }

      final data = jsonDecode(response.body);
      final String token = data['token'];
      final String wsUrl = data['url'];

      setState(() {
        _statusMessage = 'Connecting to LiveKit room...';
      });

      // 3. Initialize Room and listeners
      _room = Room();
      _room!.addListener(_onRoomDidUpdate);

      // 4. Connect to LiveKit WebSocket
      await _room!.connect(wsUrl, token);

      setState(() {
        _statusMessage = 'Starting camera and microphone...';
      });

      // 5. Enable Camera and Microphone
      await _room!.localParticipant?.setCameraEnabled(true);
      await _room!.localParticipant?.setMicrophoneEnabled(true);

      setState(() {
        _isLive = true;
        _isLoading = false;
      });
    } catch (e) {
      print('Live Stream Error: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to start stream: $e')),
        );
        setState(() {
          _isLive = false;
          _isLoading = false;
          _statusMessage = 'Stream failed. Try again.';
        });
      }
    }
  }

  void _onRoomDidUpdate() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _room?.removeListener(_onRoomDidUpdate);
    _room?.disconnect();
    _room?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Extract local video track for preview
    VideoTrack? videoTrack;
    if (_room != null && _room!.localParticipant != null) {
      for (var publication in _room!.localParticipant!.videoTrackPublications) {
        if (publication.track != null && publication.track is VideoTrack) {
          videoTrack = publication.track as VideoTrack;
          break;
        }
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('CCF Admin Live Broadcast')),
      body: Stack(
        children: [
          // 1. Video Preview Background or Status Text
          if (_isLive && videoTrack != null)
            Positioned.fill(
              child: VideoTrackView(videoTrack!),
            )
          else
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24.0),
                child: Text(
                  _isLoading ? _statusMessage : (_isLive ? 'Initializing camera feed...' : 'Stream is offline'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 18, color: Colors.black54, fontWeight: FontWeight.w500),
                ),
              ),
            ),

          // 2. Loading Indicator Overlay
          if (_isLoading)
            Container(
              color: Colors.black45,
              child: const Center(child: CircularProgressIndicator(color: Colors.white)),
            ),

          // 3. Start/End Stream Button
          Positioned(
            bottom: 40,
            left: 20,
            right: 20,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: _isLive ? Colors.red : Colors.green,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: _isLoading ? null : _toggleLiveStream,
              child: Text(
                _isLive ? 'End Live Stream' : 'Start CCF Live',
                style: const TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
