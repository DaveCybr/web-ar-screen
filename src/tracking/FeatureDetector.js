/**
 * Feature Detector - Extract and match image features
 */

import { Logger } from "../utils/Logger.js";

export class FeatureDetector {
  constructor(config) {
    this.logger = new Logger("FeatureDetector");
    this.config = config.features;
    this.trackingConfig = config.tracking;
    this.detector = null;
    this.matcher = null;
    this.vocabularyQuery = null;
  }

  /**
   * Initialize detector
   */
  async init() {
    try {
      this.logger.info(`Initializing ${this.config.detector} detector...`);

      // Create detector based on config
      switch (this.config.detector) {
        case "BRISK":
          this.detector = new cv.BRISK(
            this.config.brisk.thresh,
            this.config.brisk.octaves,
            this.config.brisk.patternScale
          );
          break;

        case "AKAZE":
          this.detector = new cv.AKAZE(
            cv.AKAZE_DESCRIPTOR_MLDB,
            0,
            3,
            this.config.akaze.threshold,
            this.config.akaze.nOctaves,
            this.config.akaze.nOctaveLayers,
            this.config.akaze.diffusivity
          );
          break;

        case "ORB":
          this.detector = new cv.ORB(
            this.config.orb.nfeatures,
            this.config.orb.scaleFactor,
            this.config.orb.nlevels
          );
          break;

        default:
          throw new Error(`Unknown detector: ${this.config.detector}`);
      }

      // Create BFMatcher
      const normType =
        this.config.detector === "ORB" ? cv.NORM_HAMMING : cv.NORM_HAMMING;
      this.matcher = new cv.BFMatcher(normType, false);

      this.logger.info("Feature detector initialized");
    } catch (error) {
      this.logger.error("Failed to initialize detector:", error);
      throw error;
    }
  }

  /**
   * Extract features from image
   */
  extractFeatures(imageMat) {
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();

    try {
      // Convert to grayscale if needed
      let gray = imageMat;
      if (imageMat.channels() > 1) {
        gray = new cv.Mat();
        cv.cvtColor(imageMat, gray, cv.COLOR_RGBA2GRAY);
      }

      // Detect and compute
      this.detector.detectAndCompute(
        gray,
        new cv.Mat(),
        keypoints,
        descriptors
      );

      // Limit features if needed
      if (keypoints.size() > this.config.maxFeaturesPerFrame) {
        const limited = this.limitFeatures(
          keypoints,
          descriptors,
          this.config.maxFeaturesPerFrame
        );
        keypoints.delete();
        descriptors.delete();
        if (gray !== imageMat) gray.delete();
        return limited;
      }

      if (gray !== imageMat) gray.delete();

      return {
        keypoints,
        descriptors,
        count: keypoints.size(),
      };
    } catch (error) {
      keypoints.delete();
      descriptors.delete();
      throw error;
    }
  }

  /**
   * Limit features to top N by response
   */
  limitFeatures(keypoints, descriptors, maxFeatures) {
    const count = keypoints.size();
    if (count <= maxFeatures) {
      return { keypoints, descriptors, count };
    }

    // Get keypoint responses
    const responses = [];
    for (let i = 0; i < count; i++) {
      responses.push({ index: i, response: keypoints.get(i).response });
    }

    // Sort by response (descending)
    responses.sort((a, b) => b.response - a.response);

    // Keep top N
    const topIndices = responses
      .slice(0, maxFeatures)
      .map((r) => r.index)
      .sort((a, b) => a - b);

    // Create new vectors with top features
    const newKeypoints = new cv.KeyPointVector();
    const newDescriptors = new cv.Mat(
      maxFeatures,
      descriptors.cols,
      descriptors.type()
    );

    for (let i = 0; i < maxFeatures; i++) {
      const idx = topIndices[i];
      newKeypoints.push_back(keypoints.get(idx));
      descriptors.row(idx).copyTo(newDescriptors.row(i));
    }

    return {
      keypoints: newKeypoints,
      descriptors: newDescriptors,
      count: maxFeatures,
    };
  }

  /**
   * Match features between frame and target
   */
  matchFeatures(frameDescriptors, targetDescriptors) {
    if (frameDescriptors.rows === 0 || targetDescriptors.rows === 0) {
      return { matches: new cv.DMatchVectorVector(), goodMatches: [] };
    }

    try {
      // KNN match (k=2 for ratio test)
      const matches = new cv.DMatchVectorVector();
      this.matcher.knnMatch(frameDescriptors, targetDescriptors, matches, 2);

      // Ratio test (Lowe's ratio test)
      const goodMatches = [];
      const ratioThreshold = this.trackingConfig.ratioThreshold;

      for (let i = 0; i < matches.size(); i++) {
        const match = matches.get(i);
        if (match.size() >= 2) {
          const m = match.get(0);
          const n = match.get(1);

          if (m.distance < ratioThreshold * n.distance) {
            goodMatches.push(m);
          }
        }
      }

      return { matches, goodMatches };
    } catch (error) {
      this.logger.error("Feature matching failed:", error);
      return { matches: new cv.DMatchVectorVector(), goodMatches: [] };
    }
  }

  /**
   * Compute homography from matches
   */
  computeHomography(frameKeypoints, targetKeypoints, goodMatches) {
    if (goodMatches.length < this.trackingConfig.minMatches) {
      return null;
    }

    try {
      // Extract point coordinates
      const srcPoints = [];
      const dstPoints = [];

      for (const match of goodMatches) {
        const targetPt = targetKeypoints.get(match.trainIdx).pt;
        const framePt = frameKeypoints.get(match.queryIdx).pt;
        srcPoints.push(targetPt.x, targetPt.y);
        dstPoints.push(framePt.x, framePt.y);
      }

      // Create Mat from points
      const srcMat = cv.matFromArray(
        goodMatches.length,
        1,
        cv.CV_32FC2,
        srcPoints
      );
      const dstMat = cv.matFromArray(
        goodMatches.length,
        1,
        cv.CV_32FC2,
        dstPoints
      );

      // Compute homography with RANSAC
      const H = cv.findHomography(srcMat, dstMat, cv.RANSAC, 5.0);

      srcMat.delete();
      dstMat.delete();

      // Validate homography
      if (H.empty() || !this.validateHomography(H)) {
        H.delete();
        return null;
      }

      return H;
    } catch (error) {
      this.logger.error("Homography computation failed:", error);
      return null;
    }
  }

  /**
   * Validate homography matrix
   */
  validateHomography(H) {
    if (H.rows !== 3 || H.cols !== 3) return false;

    // Check determinant (should be positive)
    const det = H.doubleAt(0, 0) * H.doubleAt(1, 1) * H.doubleAt(2, 2);
    if (det <= 0) return false;

    // Check if matrix is too skewed
    const h22 = H.doubleAt(2, 2);
    if (Math.abs(h22) < 0.01) return false;

    return true;
  }

  /**
   * Get corners of detected target
   */
  getTargetCorners(H, targetWidth, targetHeight) {
    try {
      // Define target corners
      const corners = cv.matFromArray(4, 1, cv.CV_32FC2, [
        0,
        0, // Top-left
        targetWidth,
        0, // Top-right
        targetWidth,
        targetHeight, // Bottom-right
        0,
        targetHeight, // Bottom-left
      ]);

      // Transform corners
      const transformedCorners = new cv.Mat();
      cv.perspectiveTransform(corners, transformedCorners, H);

      // Extract corner coordinates
      const result = {
        topLeft: {
          x: transformedCorners.floatAt(0, 0),
          y: transformedCorners.floatAt(0, 1),
        },
        topRight: {
          x: transformedCorners.floatAt(1, 0),
          y: transformedCorners.floatAt(1, 1),
        },
        bottomRight: {
          x: transformedCorners.floatAt(2, 0),
          y: transformedCorners.floatAt(2, 1),
        },
        bottomLeft: {
          x: transformedCorners.floatAt(3, 0),
          y: transformedCorners.floatAt(3, 1),
        },
      };

      corners.delete();
      transformedCorners.delete();

      return result;
    } catch (error) {
      this.logger.error("Failed to get corners:", error);
      return null;
    }
  }

  /**
   * Set vocabulary query for fast candidate selection
   */
  setVocabularyQuery(vocabularyQuery) {
    this.vocabularyQuery = vocabularyQuery;
    this.logger.info("Vocabulary query set");
  }

  /**
   * Get candidate targets using vocabulary tree
   */
  getCandidateTargets(frameDescriptors, allTargets) {
    if (!this.vocabularyQuery || frameDescriptors.rows === 0) {
      return allTargets;
    }

    try {
      return this.vocabularyQuery.query(frameDescriptors);
    } catch (error) {
      this.logger.error("Vocabulary query failed:", error);
      return allTargets;
    }
  }

  /**
   * Detect target in frame
   */
  detect(frameMat, targets) {
    try {
      // Extract frame features
      const frameFeatures = this.extractFeatures(frameMat);

      if (frameFeatures.count === 0) {
        frameFeatures.keypoints.delete();
        frameFeatures.descriptors.delete();
        return { success: false, reason: "No frame features" };
      }

      // Get candidate targets
      const candidates = this.getCandidateTargets(
        frameFeatures.descriptors,
        targets
      );

      let bestDetection = null;
      let maxScore = 0;

      // Try each candidate
      for (const target of candidates) {
        if (!target.features || target.features.descriptors.rows === 0)
          continue;

        // Match features
        const { matches, goodMatches } = this.matchFeatures(
          frameFeatures.descriptors,
          target.features.descriptors
        );

        // Compute homography
        const H = this.computeHomography(
          frameFeatures.keypoints,
          target.features.keypoints,
          goodMatches
        );

        matches.delete();

        if (H) {
          // Get corners
          const corners = this.getTargetCorners(H, target.width, target.height);

          if (corners) {
            // Calculate score
            const score = goodMatches.length / target.features.count;

            if (score > maxScore) {
              maxScore = score;
              bestDetection = {
                success: true,
                targetId: target.id,
                target,
                corners,
                matches: goodMatches.length,
                score,
                homography: H,
              };
            } else {
              H.delete();
            }
          } else {
            H.delete();
          }
        }
      }

      // Cleanup
      frameFeatures.keypoints.delete();
      frameFeatures.descriptors.delete();

      return bestDetection || { success: false, reason: "No valid detection" };
    } catch (error) {
      this.logger.error("Detection failed:", error);
      return { success: false, reason: error.message };
    }
  }

  /**
   * Cleanup
   */
  destroy() {
    if (this.detector) {
      this.detector.delete();
      this.detector = null;
    }
    if (this.matcher) {
      this.matcher.delete();
      this.matcher = null;
    }
  }
}
