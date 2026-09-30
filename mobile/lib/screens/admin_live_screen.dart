import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:livekit_client/livekit_client.dart';

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

  Future<void> _toggleLiveStream() async {
    if (_isLive) {
      await _room?.disconnect();
      setState(() {
        _isLive = false;
        _room = null;
      });
      return;
    }

    setState(() {
      _isLoading = true;
    });

    try {
      // 1. Fetch token from Render backend
      final url = Uri.parse('https://child-care-foundation-api.onrender.com/api/live/token?room=ccf-official-live');
      final response = await http.get(url);

      if (response.statusCode != 200) {
        throw Exception('Backend HTTP ${response.statusCode}: ${response.body}');
      }

      final data = jsonDecode(response.body);
      final String token = data['token'];
      final String wsUrl = data['url'];

      // 2. Initialize Room and listen for updates
      _room = Room();
      _room!.addListener(_onRoomDidUpdate);

      // 3. Connect to LiveKit WebSocket
      await _room!.connect(wsUrl, token);

      // 4. Enable Camera and Microphone
      await _room!.localParticipant?.setCameraEnabled(true);
      await _room!.localParticipant?.setMicrophoneEnabled(true);

      setState(() {
        _isLive = true;
      });
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to start stream: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
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
        if (publication.track != null) {
          videoTrack = publication.track as VideoTrack;
          break;
        }
      }
    }

    return Scaffold(
      appBar: AppBar(title: const Text('CCF Admin Live Broadcast')),
      body: Stack(
        children: [
          // 1. Video Preview Background
          if (_isLive && videoTrack != null)
            Positioned.fill(
              child: VideoTrackView(videoTrack),
            )
          else
            Center(
              child: Text(
                _isLive ? 'Initializing camera preview...' : 'Stream is offline',
                style: const TextStyle(fontSize: 16, color: Colors.grey),
              ),
            ),

          // 2. Loading Indicator
          if (_isLoading)
            Container(
              color: Colors.black54,
              child: const Center(child: CircularProgressIndicator()),
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
                style: const TextStyle(fontSize: 18, color: Colors.white),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
