/**
 * Vocabulary Tree - Fast image retrieval using bag of words
 */

import { Logger } from "../utils/Logger.js";

export class VocabularyTree {
  constructor(config) {
    this.logger = new Logger("VocabularyTree");
    this.config = config.vocabulary;
    this.vocabulary = [];
    this.targetFeatures = new Map();
    this.idf = new Map();
  }

  /**
   * Build vocabulary from target features
   */
  async build(targets) {
    this.logger.info(`Building vocabulary from ${targets.length} targets...`);

    // Collect all descriptors
    const allDescriptors = [];
    targets.forEach((target) => {
      if (target.features && target.features.descriptors) {
        for (let i = 0; i < target.features.descriptors.rows; i++) {
          const descriptor = [];
          for (let j = 0; j < target.features.descriptors.cols; j++) {
            descriptor.push(target.features.descriptors.ucharAt(i, j));
          }
          allDescriptors.push(descriptor);
        }
      }
    });

    if (allDescriptors.length === 0) {
      this.logger.warn("No descriptors to build vocabulary");
      return;
    }

    // K-means clustering (simplified)
    this.vocabulary = this.kmeansClustering(allDescriptors, this.config.size);

    // Build inverted index for each target
    targets.forEach((target) => {
      if (target.features) {
        const bow = this.computeBagOfWords(target.features.descriptors);
        this.targetFeatures.set(target.id, bow);
      }
    });

    // Compute IDF
    this.computeIDF();

    this.logger.info(`Vocabulary built: ${this.vocabulary.length} words`);
  }

  /**
   * Simple k-means clustering
   */
  kmeansClustering(descriptors, k) {
    const clusters = [];

    // Initialize with random descriptors
    for (let i = 0; i < Math.min(k, descriptors.length); i++) {
      clusters.push([...descriptors[i]]);
    }

    // Simple iteration (simplified for brevity)
    for (let iter = 0; iter < 10; iter++) {
      const assignments = descriptors.map((d) =>
        this.findNearestCluster(d, clusters)
      );

      // Update clusters
      for (let i = 0; i < k; i++) {
        const assigned = descriptors.filter((_, idx) => assignments[idx] === i);
        if (assigned.length > 0) {
          clusters[i] = this.computeMean(assigned);
        }
      }
    }

    return clusters;
  }

  /**
   * Find nearest cluster
   */
  findNearestCluster(descriptor, clusters) {
    let minDist = Infinity;
    let nearest = 0;

    for (let i = 0; i < clusters.length; i++) {
      const dist = this.hammingDistance(descriptor, clusters[i]);
      if (dist < minDist) {
        minDist = dist;
        nearest = i;
      }
    }

    return nearest;
  }

  /**
   * Compute hamming distance
   */
  hammingDistance(a, b) {
    let dist = 0;
    for (let i = 0; i < a.length; i++) {
      dist += this.popcount(a[i] ^ b[i]);
    }
    return dist;
  }

  /**
   * Count set bits
   */
  popcount(n) {
    let count = 0;
    while (n) {
      count += n & 1;
      n >>= 1;
    }
    return count;
  }

  /**
   * Compute mean descriptor
   */
  computeMean(descriptors) {
    const mean = new Array(descriptors[0].length).fill(0);
    descriptors.forEach((d) => {
      d.forEach((val, idx) => (mean[idx] += val));
    });
    return mean.map((v) => Math.round(v / descriptors.length));
  }

  /**
   * Compute bag of words for descriptors
   */
  computeBagOfWords(descriptors) {
    const bow = new Map();

    for (let i = 0; i < descriptors.rows; i++) {
      const descriptor = [];
      for (let j = 0; j < descriptors.cols; j++) {
        descriptor.push(descriptors.ucharAt(i, j));
      }

      const wordIdx = this.findNearestCluster(descriptor, this.vocabulary);
      bow.set(wordIdx, (bow.get(wordIdx) || 0) + 1);
    }

    return bow;
  }

  /**
   * Compute IDF (Inverse Document Frequency)
   */
  computeIDF() {
    const N = this.targetFeatures.size;
    const df = new Map();

    // Count document frequency for each word
    this.targetFeatures.forEach((bow) => {
      bow.forEach((count, word) => {
        df.set(word, (df.get(word) || 0) + 1);
      });
    });

    // Compute IDF
    df.forEach((count, word) => {
      this.idf.set(word, Math.log(N / count));
    });
  }

  /**
   * Query vocabulary tree
   */
  query(queryDescriptors) {
    if (this.vocabulary.length === 0) {
      return [];
    }

    // Compute query bag of words
    const queryBow = this.computeBagOfWords(queryDescriptors);

    // Compute TF-IDF
    const queryTfidf = new Map();
    queryBow.forEach((count, word) => {
      const tf = count / queryDescriptors.rows;
      const idf = this.idf.get(word) || 0;
      queryTfidf.set(word, tf * idf);
    });

    // Score all targets
    const scores = [];
    this.targetFeatures.forEach((targetBow, targetId) => {
      let score = 0;

      // Compute cosine similarity
      queryTfidf.forEach((queryWeight, word) => {
        const targetCount = targetBow.get(word) || 0;
        if (targetCount > 0) {
          const targetWeight = targetCount * (this.idf.get(word) || 0);
          score += queryWeight * targetWeight;
        }
      });

      scores.push({ targetId, score });
    });

    // Sort by score and return top candidates
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, this.config.topCandidates).map((s) => s.targetId);
  }
}
